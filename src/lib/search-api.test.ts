import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn(), searches: [] as { table: string; columns: string; firm?: string; filter?: string; range?: number[] }[], rows: {} as Record<string, Record<string, unknown>[]>, failures: new Set<string>() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mock.getUser },
  from: (table: string) => ({ select: (columns: string) => {
    if (table === "profiles" && columns.includes("must_change_password")) return { eq: () => ({ maybeSingle: mock.profile }) };
    const call = { table, columns } as typeof mock.searches[number]; mock.searches.push(call);
    const builder = {
      eq: (_column: string, value: string) => { call.firm = value; return builder; },
      or: (filter: string) => { call.filter = filter; return builder; },
      order: () => builder,
      range: (start: number, end: number) => { call.range = [start,end]; return builder; },
      returns: () => builder,
      abortSignal: async () => ({ data: mock.rows[table] || [], error: mock.failures.has(table) ? { message: "Internal database detail" } : null }),
    }; return builder;
  } }),
}) }));
import { POST } from "../app/api/search/route";
const request = (body: unknown = { q: "Jane" }) => new Request("http://localhost/api/search", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();mock.searches.length=0;mock.rows={};mock.failures.clear();
  mock.getUser.mockResolvedValue({ data: { user: { id: "staff-id" } }, error: null });
  mock.profile.mockResolvedValue({ data: { role: "staff", status: "active", firm_id: "authorized-firm", must_change_password: false }, error: null });
});
describe("staff search API", () => {
  it("blocks unsigned, anonymous, and expired sessions before reading records", async () => {
    for (const result of [{ data: { user: null } }, { data: { user: { id: "anonymous", is_anonymous: true } } }, { data: { user: { id: "stale" } }, error: { message: "Expired" } }]) {
      mock.getUser.mockResolvedValue(result);
      const response = await POST(request());expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
    expect(mock.searches).toHaveLength(0);
  });
  it.each(["disabled","invited","client","missing","password-change"])("blocks %s accounts", async (value) => {
    mock.profile.mockResolvedValue({ data: value === "missing" ? null : { role: value === "client" ? "client" : "staff", firm_id: "firm", status: ["disabled","invited"].includes(value) ? value : "active", must_change_password: value === "password-change" } });
    expect((await POST(request())).status).toBe(403);expect(mock.searches).toHaveLength(0);
  });
  it("uses the staff firm for every table and never accepts a submitted firm or role", async () => {
    mock.rows.clients = [{ id: "client", name: "Jane", token_hash: "secret" }];
    const response = await POST(request({ q: "Jane", firm_id: "other-firm", role: "admin" }));
    expect(response.status).toBe(200);expect(mock.searches).toHaveLength(14);
    expect(mock.searches.every((call) => call.firm === "authorized-firm" && call.range?.[1] === 10)).toBe(true);
    expect(mock.searches.some((call) => call.table === "profiles")).toBe(false);
    expect(await response.json()).toMatchObject({ partial: false, groups: expect.arrayContaining([expect.objectContaining({ key: "clients", results: [expect.objectContaining({ title: "Jane" })] })]) });
  });
  it("does not allow staff to request the admin directory", async () => {
    expect((await POST(request({ q: "Jane", category: "users" }))).status).toBe(403);expect(mock.searches).toHaveLength(0);
  });
  it("allows the directory for an active admin", async () => {
    mock.profile.mockResolvedValue({ data: { role: "admin", status: "active", firm_id: "authorized-firm" } });
    expect((await POST(request({ q: "Jane", category: "users" }))).status).toBe(200);
    expect(mock.searches[0].table).toBe("profiles");
  });
  it("paginates categories and indicates additional matches", async () => {
    mock.rows.clients = Array.from({ length: 11 }, (_, id) => ({ id: String(id), name: "Jane" }));
    const response = await POST(request({ q: "Jane", category: "clients", page: 2 }));
    const body = await response.json();expect(body.groups[0].results).toHaveLength(10);expect(body.groups[0].hasMore).toBe(true);
    expect(mock.searches[0].range).toEqual([20,30]);
  });
  it("reports partial failure without exposing internal details or hiding failed categories", async () => {
    mock.failures.add("documents");
    const response = await POST(request());const body = await response.json();
    expect(body.partial).toBe(true);expect(body.unavailable).toEqual(["Documents"]);
    expect(JSON.stringify(body)).not.toContain("Internal database");
  });
  it("returns failure when a selected category cannot be searched", async () => {
    mock.failures.add("clients");expect((await POST(request({ q: "Jane", category: "clients" }))).status).toBe(503);
  });
  it("rejects invalid query input without fetching records", async () => {
    expect((await POST(request({ q: "x" }))).status).toBe(400);expect(mock.searches).toHaveLength(0);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  getUser: vi.fn(), profile: vi.fn(), insert: vi.fn(), saved: vi.fn(), rpc: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mock.getUser }, rpc: mock.rpc,
  from: (table: string) => table === "profiles" ? {
    select: () => ({ eq: () => ({ maybeSingle: mock.profile }) }),
  } : { insert: (record: unknown) => { mock.insert(record); return { select: () => ({ single: mock.saved }) }; } },
}) }));
import { POST as manualPost } from "../app/api/appointments/route";
import { POST as intakePost } from "../app/api/intakes/[id]/appointment/route";

const body = { name: "Sample client", eventType: "Phone call", startsAt: "2026-10-08T14:00:00Z", durationMinutes: 30 };
const request = (data: unknown = body) => new Request("http://localhost/api/appointments", { method: "POST", body: JSON.stringify(data) });

beforeEach(() => {
  vi.clearAllMocks();
  mock.getUser.mockResolvedValue({ data: { user: { id: "staff-user" } } });
  mock.profile.mockResolvedValue({ data: { firm_id: "staff-firm", role: "staff", status: "active" } });
  mock.saved.mockResolvedValue({ data: { id: "event-id", starts_at: body.startsAt, ends_at: "2026-10-08T14:30:00Z" }, error: null });
  mock.rpc.mockResolvedValue({ data: "event-id", error: null });
});

describe("appointment endpoints", () => {
  it("saves manual appointments with the authenticated firm", async () => {
    const response = await manualPost(request({ ...body, firm_id: "forged-firm" }));
    expect(response.status).toBe(201);
    expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({ firm_id: "staff-firm", ends_at: "2026-10-08T14:30:00.000Z" }));
    expect(await response.json()).toMatchObject({ eventId: "event-id" });
  });
  it("routes intake appointments through the existing atomic workflow", async () => {
    const response = await intakePost(request(body), { params: Promise.resolve({ id: "intake-id" }) });
    expect(response.status).toBe(201);
    expect(mock.rpc).toHaveBeenCalledWith("schedule_intake_consultation", expect.objectContaining({
      p_intake_id: "intake-id", p_starts_at: "2026-10-08T14:00:00.000Z", p_ends_at: "2026-10-08T14:30:00.000Z",
    }));
    expect(mock.insert).not.toHaveBeenCalled();
  });
  it.each(["readonly", "disabled", "invited"])("does not write for %s users", async (value) => {
    mock.profile.mockResolvedValue({ data: { firm_id: "staff-firm", role: value === "readonly" ? value : "staff", status: value === "readonly" ? "active" : value } });
    expect((await manualPost(request())).status).toBe(403);
    expect((await intakePost(request(), { params: Promise.resolve({ id: "intake-id" }) })).status).toBe(403);
    expect(mock.insert).not.toHaveBeenCalled();
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated requests", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null } });
    expect((await manualPost(request())).status).toBe(401);
    expect(mock.insert).not.toHaveBeenCalled();
  });
  it("rejects invalid dates and durations before writing", async () => {
    expect((await manualPost(request({ ...body, durationMinutes: 0 }))).status).toBe(400);
    expect(mock.insert).not.toHaveBeenCalled();
  });
  it("surfaces a save failure without reporting success", async () => {
    mock.saved.mockResolvedValue({ data: null, error: { message: "Save failed" } });
    const response = await manualPost(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Save failed" });
  });
});

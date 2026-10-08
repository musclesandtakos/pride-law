import { describe, expect, it } from "vitest";
import { canSearch, searchColumns, searchFilter, searchRequestSchema, searchResult, searchSources, sourcesForRole } from "./search";

const source = (key: string) => searchSources.find((item) => item.key === key)!;
describe("firm record search", () => {
  it("searches business records while retaining admin-only directory access", () => {
    expect(sourcesForRole("staff")).toHaveLength(14);
    expect(sourcesForRole("admin")).toHaveLength(15);
    expect(sourcesForRole("staff").some((item) => item.table === "profiles")).toBe(false);
    const selected = searchSources.map(searchColumns).join(",");
    expect(selected).not.toMatch(/token|secret|storage_path|password|changed_data/);
  });
  it("requires an active firm staff profile", () => {
    expect(canSearch({ firm_id: "firm", role: "staff", status: "active" })).toBe(true);
    expect(canSearch({ firm_id: "firm", role: "readonly", status: "active" })).toBe(true);
    for (const profile of [null, { firm_id: null, role: "staff", status: "active" }, { firm_id: "firm", role: "client", status: "active" }, { firm_id: "firm", role: "staff", status: "disabled" }, { firm_id: "firm", role: "staff", status: "invited" }, { firm_id: "firm", role: "staff", status: "active", must_change_password: true }]) {
      expect(canSearch(profile)).toBe(false);
    }
  });
  it("validates searches and bounds pagination", () => {
    expect(searchRequestSchema.parse({ q: " Jane " }).q).toBe("Jane");
    for (const q of ["", "x", "x".repeat(121), "a*", "ab\ncd"]) expect(searchRequestSchema.safeParse({ q }).success).toBe(false);
    expect(searchRequestSchema.safeParse({ q: "Jane", category: "credentials" }).success).toBe(false);
    expect(searchRequestSchema.safeParse({ q: "Jane", page: -1 }).success).toBe(false);
  });
  it("keeps filter punctuation inside a quoted literal and escapes wildcard characters", () => {
    const filter = searchFilter({ ...source("clients"), text: ["name"] }, 'Jane",firm_id.neq.null)');
    expect(filter).toBe(String.raw`name.ilike."%Jane\",firm\\_id.neq.null)%"`);
    expect(searchFilter({ ...source("clients"), text: ["name"] }, "50%_test")).toBe('name.ilike."%50\\\\%\\\\_test%"');
  });
  it("finds amounts and Eastern appointment dates", () => {
    expect(searchFilter(source("invoices"), "45.50")).toContain("amount.eq.45.5");
    expect(searchFilter(source("documents"), "45.50")).not.toContain("file_size.eq");
    expect(searchFilter(source("events"), "2026-10-08")).toContain("and(starts_at.gte.2026-10-08T04:00:00.000Z,starts_at.lt.2026-10-09T04:00:00.000Z)");
    expect(searchFilter(source("tasks"), "2026-02-30")).not.toContain("due_date.eq");
  });
  it("returns a compact safe result and opens the linked record", () => {
    const row = { id: "response-id", intake_id: "intake-id", legal_name: "Jane Client", matter_summary: "x".repeat(500) + " collision details", token_hash: "never-return" };
    const result = searchResult(source("intake-forms"), row, "collision");
    expect(result.href).toBe("/intakes?record=intake-id");
    expect(result.snippet).toContain("collision");
    expect(result.snippet.length).toBeLessThanOrEqual(192);
    expect(JSON.stringify(result)).not.toContain("never-return");
    expect(searchResult(source("communications"), { id: "communication-id", client_id: "client-id" }, "note").href).toBe("/clients/client-id?communication=communication-id#communication-communication-id");
    expect(searchResult(source("documents"), { id: "document-id" }, "report").href).toBe("/documents?record=document-id#document-document-id");
    expect(searchResult(source("audit"), { id: "audit-id" }, "update").href).toBe("/audit?record=audit-id");
    expect(searchResult(source("events"), { id: "event", starts_at: "2026-10-08T13:00:00Z" }, "consultation").href).toBe("/events?week=2026-10-05#event-event");
  });
});

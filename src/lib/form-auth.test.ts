import { beforeEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mock.getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mock.profile }) }),
    }),
  }),
}));
import { formContext } from "./form-auth";
beforeEach(() => {
  mock.getUser.mockResolvedValue({
    data: { user: { id: "staff" } },
    error: null,
  });
  mock.profile.mockResolvedValue({
    data: {
      firm_id: "firm",
      role: "staff",
      status: "active",
      must_change_password: false,
    },
  });
});
describe("client form authorization", () => {
  it("rejects absent, anonymous and expired sessions", async () => {
    for (const value of [
      { data: { user: null } },
      { data: { user: { id: "anon", is_anonymous: true } } },
      { data: { user: { id: "staff" } }, error: { message: "expired" } },
    ]) {
      mock.getUser.mockResolvedValue(value);
      expect((await formContext(true)).error?.status).toBe(401);
    }
  });
  it.each(["billing", "readonly"])(
    "permits %s to read but not edit",
    async (role) => {
      mock.profile.mockResolvedValue({
        data: { firm_id: "firm", role, status: "active" },
      });
      expect((await formContext()).error).toBeUndefined();
      expect((await formContext(true)).error?.status).toBe(403);
    },
  );
  it.each(["invited", "disabled", "password-change", "client"])(
    "rejects %s accounts",
    async (state) => {
      mock.profile.mockResolvedValue({
        data: {
          firm_id: "firm",
          role: state === "client" ? "client" : "staff",
          status: ["invited", "disabled"].includes(state) ? state : "active",
          must_change_password: state === "password-change",
        },
      });
      expect((await formContext()).error?.status).toBe(403);
    },
  );
  it("reserves source mapping and approval for administrators", async () => {
    expect((await formContext(true, true)).error?.status).toBe(403);
    mock.profile.mockResolvedValue({
      data: { firm_id: "firm", role: "admin", status: "active" },
    });
    expect((await formContext(true, true)).error).toBeUndefined();
  });
});

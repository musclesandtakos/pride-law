import { describe, expect, it } from "vitest";
import { upsertMember, type WorkspaceMember } from "./member-list";

const member: WorkspaceMember = {
  id: "member-1",
  full_name: "Pride Law Staff",
  email: "staff@thepridelaw.com",
  role: "staff",
  status: "invited",
  created_at: "2026-09-17T00:00:00.000Z",
  must_change_password: false,
  temporary_password_expires_at: null,
};

describe("upsertMember", () => {
  it("adds a new member", () => {
    expect(upsertMember([], member)).toEqual([member]);
  });

  it("replaces an existing member instead of duplicating the row", () => {
    const active = { ...member, status: "active" };
    expect(upsertMember([member], active)).toEqual([active]);
  });
});

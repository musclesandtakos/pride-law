import { describe, expect, it, vi } from "vitest";
import { inviteUserIdempotently, type InviteProfile } from "./invite-user";

const profile: InviteProfile = {
  id: "profile-1",
  email: "staff@thepridelaw.com",
  role: "staff",
  status: "invited",
};

describe("inviteUserIdempotently", () => {
  it("returns an existing profile without sending another invitation", async () => {
    const inviteUser = vi.fn();
    const updateProfile = vi.fn();

    const result = await inviteUserIdempotently({
      findExistingProfile: vi.fn().mockResolvedValue(profile),
      inviteUser,
      updateProfile,
    });

    expect(result).toEqual({
      body: { ...profile, invitation_reused: true },
      status: 200,
    });
    expect(inviteUser).not.toHaveBeenCalled();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("recovers when a concurrent invitation creates the profile first", async () => {
    const findExistingProfile = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(profile);

    const result = await inviteUserIdempotently({
      findExistingProfile,
      inviteUser: vi.fn().mockResolvedValue({
        userId: null,
        error: "Database error saving new user",
      }),
      updateProfile: vi.fn(),
    });

    expect(result).toEqual({
      body: { ...profile, invitation_reused: true },
      status: 200,
    });
    expect(findExistingProfile).toHaveBeenCalledTimes(2);
  });

  it("preserves a genuine invitation error when no profile was created", async () => {
    const result = await inviteUserIdempotently({
      findExistingProfile: vi.fn().mockResolvedValue(null),
      inviteUser: vi.fn().mockResolvedValue({
        userId: null,
        error: "Email delivery failed",
      }),
      updateProfile: vi.fn(),
    });

    expect(result).toEqual({
      body: { error: "Email delivery failed" },
      status: 400,
    });
  });

  it("returns the newly invited profile", async () => {
    const result = await inviteUserIdempotently({
      findExistingProfile: vi.fn().mockResolvedValue(null),
      inviteUser: vi.fn().mockResolvedValue({ userId: "profile-1", error: null }),
      updateProfile: vi.fn().mockResolvedValue({ profile, error: null }),
    });

    expect(result).toEqual({ body: profile, status: 201 });
  });
});

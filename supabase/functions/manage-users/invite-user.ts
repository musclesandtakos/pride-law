export type InviteProfile = {
  id: string;
  [key: string]: unknown;
};

type InviteAttempt = {
  userId: string | null;
  error: string | null;
};

type ProfileUpdate = {
  profile: InviteProfile | null;
  error: string | null;
};

type InviteDependencies = {
  findExistingProfile: () => Promise<InviteProfile | null>;
  inviteUser: () => Promise<InviteAttempt>;
  updateProfile: (userId: string) => Promise<ProfileUpdate>;
};

export type InviteOutcome = {
  body: InviteProfile | { error: string };
  status: 200 | 201 | 400;
};

function reused(profile: InviteProfile): InviteOutcome {
  return {
    body: { ...profile, invitation_reused: true },
    status: 200,
  };
}

export async function inviteUserIdempotently({
  findExistingProfile,
  inviteUser,
  updateProfile,
}: InviteDependencies): Promise<InviteOutcome> {
  const existing = await findExistingProfile();
  if (existing) return reused(existing);

  const invitation = await inviteUser();
  if (invitation.error || !invitation.userId) {
    // A second request can race the first one. Re-read the profile before
    // surfacing Auth's duplicate-insert error so retries stay idempotent.
    const concurrentProfile = await findExistingProfile();
    if (concurrentProfile) return reused(concurrentProfile);

    return {
      body: { error: invitation.error || "Unable to invite user" },
      status: 400,
    };
  }

  const updated = await updateProfile(invitation.userId);
  if (updated.error || !updated.profile) {
    return {
      body: { error: updated.error || "Unable to save the invited user" },
      status: 400,
    };
  }

  return { body: updated.profile, status: 201 };
}

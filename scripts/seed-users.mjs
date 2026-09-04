import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const REDIRECT_TO = `${APP_URL}/auth/callback`;
const DEFAULT_FIRM_ID = "00000000-0000-0000-0000-000000000001";
const VALID_ROLES = new Set(["admin", "attorney", "staff", "billing", "readonly"]);

const USERS = [
  { email: "mtzbmtz01@gmail.com", role: "admin" },
  { email: "nreinfeld@thepridelaw.com", role: "staff" },
  { email: "jhenn@thepridelaw.com", role: "staff" },
  { email: "info@thepridelaw.com", role: "staff" },
];

function deriveFullName(email) {
  const local = (email.split("@")[0] || "").trim();
  if (!local) return "Team Member";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isAlreadyExistsError(message) {
  return /already.*(registered|exists|been registered|in use)/i.test(message || "");
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const results = [];

for (const member of USERS) {
  const email = member.email.trim().toLowerCase();
  const role = member.role.trim().toLowerCase();
  const fullName = deriveFullName(email);

  if (!VALID_ROLES.has(role)) {
    results.push({ email, status: "failed", detail: `Invalid role "${role}"` });
    continue;
  }

  const { data: existingProfile, error: existingProfileError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfileError) {
    results.push({ email, status: "failed", detail: existingProfileError.message });
    continue;
  }

  if (existingProfile) {
    results.push({ email, status: "skipped", detail: "Profile already exists" });
    continue;
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: REDIRECT_TO,
  });

  if (inviteError || !invited?.user?.id) {
    if (isAlreadyExistsError(inviteError?.message)) {
      results.push({ email, status: "skipped", detail: "Auth user already exists" });
      continue;
    }

    results.push({ email, status: "failed", detail: inviteError?.message || "Invite failed without a user id" });
    continue;
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      firm_id: DEFAULT_FIRM_ID,
      full_name: fullName,
      email,
      role,
      status: "invited",
    })
    .eq("id", invited.user.id);

  if (profileError) {
    results.push({ email, status: "failed", detail: profileError.message });
    continue;
  }

  results.push({ email, status: "invited", detail: `${fullName} (${role})` });
}

console.log(`Seed users summary (redirect: ${REDIRECT_TO})`);
for (const result of results) {
  console.log(`- ${result.email}: ${result.status} — ${result.detail}`);
}

if (results.some((result) => result.status === "failed")) {
  process.exitCode = 1;
}

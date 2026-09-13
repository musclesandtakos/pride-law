import { redirect } from "next/navigation";
import { completeOnboarding } from "./actions";
import { createClient } from "@/lib/supabase/server";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  attorney: "Attorney",
  staff: "Staff",
  billing: "Billing",
  readonly: "Read only",
};

export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?error=" + encodeURIComponent("Your invitation session has expired."));

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,email,role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.status !== "active") {
    redirect("/login?error=" + encodeURIComponent("Your account is not active."));
  }

  const name = profile.full_name || user.user_metadata.full_name || "there";
  const email = profile.email || user.email || "";
  const role = ROLE_LABELS[profile.role] || profile.role;

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="seal">P</div>
        <p>PRIDE LAW</p>
        <h1>Welcome, {name}.</h1>
        <span>Your invitation is verified. Create a password to finish setting up your account.</span>
      </section>
      <section className="login-panel">
        <form action={completeOnboarding} className="login-form">
          <div className="eyebrow">ACCOUNT ONBOARDING</div>
          <h2>Complete your setup</h2>
          <p>
            {email} · {role}
          </p>
          {error && <div className="error">{error}</div>}
          <label>
            Create password
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label>
            Confirm password
            <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <button className="primary" type="submit">
            Complete setup
          </button>
          <small>You will sign in with this email and password after setup.</small>
        </form>
      </section>
    </main>
  );
}

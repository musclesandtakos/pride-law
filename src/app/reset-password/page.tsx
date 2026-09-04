import { updatePassword } from "./actions";

export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="seal">P</div>
        <p>PRIDE LAW</p>
        <h1>Create a new password.</h1>
        <span>This secure update applies to your existing Pride Law account.</span>
      </section>
      <section className="login-panel">
        <form action={updatePassword} className="login-form">
          <div className="eyebrow">ACCOUNT RECOVERY</div>
          <h2>Set new password</h2>
          <p>Choose a strong password with at least 8 characters.</p>
          {error && <div className="error">{error}</div>}
          <label>
            New password
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label>
            Confirm password
            <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <button className="primary" type="submit">
            Update password
          </button>
          <small>If your recovery link expired, request a new one from sign in.</small>
        </form>
      </section>
    </main>
  );
}

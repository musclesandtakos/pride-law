import Link from "next/link";
import { requestPasswordReset } from "@/app/login/actions";

export default async function ForgotPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="seal">P</div>
        <p>PRIDE LAW</p>
        <h1>Reset your password.</h1>
        <span>Enter your account email and we’ll send a secure recovery link.</span>
      </section>
      <section className="login-panel">
        <form action={requestPasswordReset} className="login-form">
          <div className="eyebrow">ACCOUNT RECOVERY</div>
          <h2>Forgot password</h2>
          <p>Use your authorized Pride Law account email.</p>
          {error && <div className="error">{error}</div>}
          {message && <div className="notice">{message}</div>}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <button className="primary" type="submit">
            Send reset link
          </button>
          <small>
            <Link href="/login">Back to sign in</Link>
          </small>
        </form>
      </section>
    </main>
  );
}

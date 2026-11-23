import Link from "next/link";
import { login } from "./actions";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="seal">W</div>
        <p>WritRelay</p>
        <h1>Run the firm with clarity.</h1>
        <span>Secure case management for matters, clients, deadlines, documents, and billing.</span>
      </section>
      <section className="login-panel">
        <form action={login} className="login-form">
          <div className="eyebrow">FIRM OPERATIONS</div>
          <h2>Welcome back</h2>
          <p>Sign in with your authorized WritRelay account.</p>
          {error && <div className="error">{error}</div>}
          {message && <div className="notice">{message}</div>}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="primary" type="submit">
            Sign in
          </button>
          <small>
            <Link href="/forgot-password">Forgot your password?</Link>
          </small>
          <small>Protected by Supabase Auth and row-level security.</small>
        </form>
      </section>
    </main>
  );
}

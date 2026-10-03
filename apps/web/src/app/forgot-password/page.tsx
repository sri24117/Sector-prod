"use client";

import { useState } from "react";
import { api } from "../../lib/api";
import { Field, Message } from "../../lib/ui";

// Pilot flow: the request is recorded and SEctOr sends the reset link personally
// (apps/api/src/scripts/reset-link.ts). The page says exactly that, no more.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await api<{ message: string }>("/auth/password-reset/request", { method: "POST", body: { email } });
      setSent(r.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page page-narrow">
      <a className="wordmark" href="/">SEctOr</a>
      <div className="page-head" style={{ marginTop: "var(--s-7)" }}>
        <h1 className="headline">Reset your password</h1>
        <p className="muted prose">Enter the email you signed up with. SEctOr will send you a link to choose a new password.</p>
      </div>
      {sent ? (
        <Message text={sent} tone="ok" />
      ) : (
        <form onSubmit={handleSubmit}>
          <Field label="Email">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          <div className="actions">
            {error && <div style={{ width: "100%" }}><Message text={error} /></div>}
            <button type="submit" className="btn btn-block" disabled={loading}>{loading ? "Sending…" : "Request a reset link"}</button>
          </div>
        </form>
      )}
      <p className="small" style={{ marginTop: "var(--s-5)" }}>Remembered it? <a href="/login">Log in</a></p>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Field, Message } from "../../lib/ui";

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== repeat) { setError("The two passwords do not match."); return; }
    setLoading(true);
    try {
      const r = await api<{ message: string }>("/auth/password-reset/confirm", { method: "POST", body: { token, password } });
      setDone(r.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change your password. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page page-narrow">
      <a className="wordmark" href="/">SEctOr</a>
      <div className="page-head" style={{ marginTop: "var(--s-7)" }}>
        <h1 className="headline">Choose a new password</h1>
      </div>
      {token === "" && <Message text="This page needs the reset link SEctOr sent you. Open the link again, or ask for a new one." />}
      {done && (
        <div className="stack-4">
          <Message text={done} tone="ok" />
          <a className="btn" href="/login">Log in</a>
        </div>
      )}
      {token && !done && (
        <form onSubmit={handleSubmit}>
          <Field label="New password" hint="At least 10 characters. You will be signed out on every other device.">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={10} required />
          </Field>
          <Field label="Repeat new password">
            <input className="input" type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" minLength={10} required />
          </Field>
          <div className="actions">
            {error && <div style={{ width: "100%" }}><Message text={error} /></div>}
            <button type="submit" className="btn btn-block" disabled={loading}>{loading ? "Saving…" : "Set new password"}</button>
          </div>
        </form>
      )}
    </main>
  );
}

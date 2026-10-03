"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Message } from "../../lib/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Could not log in.");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page page-narrow">
      <a className="wordmark" href="/">SEctOr</a>
      <div className="page-head" style={{ marginTop: "var(--s-7)" }}>
        <h1 className="headline">Log in</h1>
      </div>
      <form onSubmit={handleSubmit}>
        <Field label="Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </Field>
        <Field label="Password">
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        <div className="actions">
          {error && <div style={{ width: "100%" }}><Message text={error} /></div>}
          <button type="submit" className="btn btn-block" disabled={loading}>{loading ? "Logging in…" : "Log in"}</button>
        </div>
      </form>
      <p className="small" style={{ marginTop: "var(--s-5)" }}>No account yet? <a href="/signup">Create one</a></p>
    </main>
  );
}

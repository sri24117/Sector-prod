"use client";

// Slice 2: see docs/plans/phase-0-1-roadmap.md. Calls apps/api's
// POST /auth/signup with credentials so the session cookie is stored.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Message } from "../../lib/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ organizationName: "", name: "", email: "", password: "", fcraSelfDeclared: false, panNumber: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: form.organizationName,
          name: form.name,
          email: form.email,
          password: form.password,
          fcraSelfDeclared: form.fcraSelfDeclared,
          panNumber: form.panNumber || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Could not create your account.");
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
        <h1 className="headline">Create your organization account</h1>
        <p className="muted prose">Takes about a minute. You can run audits as soon as you are in.</p>
      </div>
      <form onSubmit={handleSubmit}>
        <Field label="Organization name">
          <input className="input" value={form.organizationName} onChange={(e) => set("organizationName", e.target.value)} autoComplete="organization" required />
        </Field>
        <Field label="Your name">
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" required />
        </Field>
        <Field label="Work email">
          <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" required />
        </Field>
        <Field label="Password" hint="At least 10 characters.">
          <input className="input" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" minLength={10} required />
        </Field>

        <div className="section" style={{ marginTop: "var(--s-6)" }}>
          <h2 className="section-heading">Registration details</h2>
          <p className="small prose" style={{ margin: "var(--s-2) 0 var(--s-4)" }}>
            These are self-declared. SEctOr does not verify them at signup. They decide which tools are
            offered, for example Google Ad Grants needs FCRA registration.
          </p>
          <label className="check">
            <input type="checkbox" checked={form.fcraSelfDeclared} onChange={(e) => set("fcraSelfDeclared", e.target.checked)} />
            <span>We are FCRA registered</span>
          </label>
          <Field label="PAN number" hint="Optional.">
            <input className="input" value={form.panNumber} onChange={(e) => set("panNumber", e.target.value)} autoComplete="off" />
          </Field>
        </div>

        <div className="actions">
          {error && <div style={{ width: "100%" }}><Message text={error} /></div>}
          <button type="submit" className="btn btn-block" disabled={loading}>{loading ? "Creating account…" : "Create account"}</button>
        </div>
      </form>
      <p className="small" style={{ marginTop: "var(--s-5)" }}>Already have an account? <a href="/login">Log in</a></p>
    </main>
  );
}

"use client";

// Slice 2 — see docs/plans/phase-0-1-roadmap.md. Calls apps/api's
// POST /auth/signup with credentials so the session cookie is stored.

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  fontSize: "1rem",
  border: "1px solid #ccc",
  borderRadius: 6,
  marginBottom: "0.75rem",
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    organizationName: "",
    name: "",
    email: "",
    password: "",
    fcraSelfDeclared: false,
    panNumber: "",
  });
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
    <main style={{ fontFamily: "system-ui", padding: "3rem 1.5rem", maxWidth: 480, margin: "0 auto" }}>
      <h1>Create your organization account</h1>
      <p style={{ color: "#666" }}>
        FCRA/PAN/12A/80G below are self-declared — not independently verified
        at this stage.
      </p>
      <form onSubmit={handleSubmit}>
        <input
          style={inputStyle}
          placeholder="Organization name"
          value={form.organizationName}
          onChange={(e) => set("organizationName", e.target.value)}
          required
        />
        <input
          style={inputStyle}
          placeholder="Your name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          required
        />
        <input
          style={inputStyle}
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          required
        />
        <input
          style={inputStyle}
          type="password"
          placeholder="Password (min. 10 characters)"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          minLength={10}
          required
        />
        <label style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={form.fcraSelfDeclared}
            onChange={(e) => set("fcraSelfDeclared", e.target.checked)}
          />
          We are FCRA registered (self-declared)
        </label>
        <input
          style={inputStyle}
          placeholder="PAN number (optional)"
          value={form.panNumber}
          onChange={(e) => set("panNumber", e.target.value)}
        />

        {error && (
          <p role="alert" style={{ color: "#b00020" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "1rem",
            borderRadius: 6,
            border: "none",
            background: "#111",
            color: "#fff",
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p style={{ marginTop: "1rem" }}>
        Already have an account? <a href="/login">Log in</a>
      </p>
    </main>
  );
}

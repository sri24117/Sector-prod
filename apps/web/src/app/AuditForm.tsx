"use client";

// Slice 1 v1 — see docs/plans/feature-spec-slice1-audit-funnel-v1.md.
// Calls apps/api's POST /audit directly; nothing here is persisted.

import { useState } from "react";

interface CheckResult {
  checkId: string;
  weight: number;
  passed: boolean;
  detail: string;
}

interface AuditResult {
  url: string;
  score: number;
  runAt: string;
  checks: CheckResult[];
}

interface ApiError {
  error: string;
  message: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const CHECK_LABELS: Record<string, string> = {
  schema: "Structured data (schema.org)",
  robots_txt_ai_block: "AI crawlers allowed in robots.txt",
  llms_txt: "llms.txt present",
  heading_hierarchy: "Heading hierarchy (H1/H2)",
  faq_pairs: "FAQ-style Q&A content",
  front_loaded_stat: "Front-loaded stat or figure",
  freshness: "Freshness signal",
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; result: AuditResult };

export default function AuditForm() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setState({ status: "loading" });

    try {
      const res = await fetch(`${API_URL}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiError | null;
        setState({
          status: "error",
          message: body?.message ?? "Something went wrong running that audit.",
        });
        return;
      }

      const result = (await res.json()) as AuditResult;
      setState({ status: "done", result });
    } catch {
      setState({
        status: "error",
        message:
          "Could not reach the audit service. Check your connection and try again.",
      });
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourorganization.org"
          aria-label="Website URL"
          style={{
            flex: 1,
            padding: "0.75rem 1rem",
            fontSize: "1rem",
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
        />
        <button
          type="submit"
          disabled={state.status === "loading"}
          style={{
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            borderRadius: 6,
            border: "none",
            background: "#111",
            color: "#fff",
            cursor: state.status === "loading" ? "default" : "pointer",
          }}
        >
          {state.status === "loading" ? "Auditing…" : "Run free audit"}
        </button>
      </form>

      {state.status === "error" && (
        <p role="alert" style={{ color: "#b00020", marginTop: "1rem" }}>
          {state.message}
        </p>
      )}

      {state.status === "done" && (
        <div style={{ marginTop: "2rem" }}>
          <h2 style={{ marginBottom: "0.25rem" }}>
            Score: {state.result.score}/100
          </h2>
          <p style={{ color: "#666", fontSize: "0.875rem", marginTop: 0 }}>
            {state.result.url} · audited {new Date(state.result.runAt).toLocaleString()}
          </p>
          <p style={{ fontSize: "0.875rem", color: "#8a6d00", background: "#fff8e1", padding: "0.5rem 0.75rem", borderRadius: 6 }}>
            Note: this audit reads the raw HTML only. Results may be incomplete for
            JavaScript-heavy sites — see roadmap for the rendering fallback.
          </p>

          <ul style={{ listStyle: "none", padding: 0 }}>
            {state.result.checks.map((c) => (
              <li
                key={c.checkId}
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  padding: "0.75rem 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <span aria-hidden style={{ color: c.passed ? "#0a8a3f" : "#b00020" }}>
                  {c.passed ? "✓" : "✗"}
                </span>
                <span>
                  <strong>{CHECK_LABELS[c.checkId] ?? c.checkId}</strong>
                  <br />
                  <span style={{ color: "#555", fontSize: "0.9rem" }}>{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>

          <div
            style={{
              marginTop: "1.5rem",
              padding: "1.25rem",
              background: "#f5f5f5",
              borderRadius: 8,
            }}
          >
            <p style={{ marginTop: 0 }}>
              Want these findings fixed, not just flagged?
            </p>
            <button
              type="button"
              onClick={() => {
                // Connect-intent CTA — instrumented, not wired to a real
                // signup/connect flow yet (that's Slice 2/3). See
                // docs/plans/feature-spec-slice1-audit-funnel-v1.md.
                console.log("connect_intent_clicked", { url: state.result.url });
                alert("Thanks — this is where account creation will go (Slice 2).");
              }}
              style={{
                padding: "0.6rem 1.25rem",
                borderRadius: 6,
                border: "none",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Talk to us about fixing this
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

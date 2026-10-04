"use client";

// Slice 1 v1: see docs/plans/feature-spec-slice1-audit-funnel-v1.md.
// Calls apps/api's POST /audit directly; nothing here is persisted.

import { useState } from "react";
import { FindingList, JourneySteps, RenderCaveat, Score, Message, ValueSummary, when, type FindingLike } from "../lib/ui";
import { track } from "../lib/api";

interface AuditResult { url: string; score: number; runAt: string; checks: FindingLike[] }
type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; result: AuditResult };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setState({ status: "error", message: body?.message ?? "Could not run that audit. Check the address and try again." });
        return;
      }
      setState({ status: "done", result: (await res.json()) as AuditResult });
    } catch {
      setState({ status: "error", message: "Could not reach the audit service. Check your connection and try again." });
    }
  }

  // Connect-intent signal for the funnel (feature-spec-slice1): recorded, then the visitor
  // goes to signup with the audited site carried over.
  const signupFor = (r: AuditResult) => `/signup?url=${encodeURIComponent(r.url)}`;
  const fixLink = (r: AuditResult) => (
    <a href={signupFor(r)} onClick={() => track("fix_clicked", r.url)}>Create an account to fix this</a>
  );

  return (
    <div>
      <JourneySteps current={state.status === "done" ? 2 : 1} />
      <form onSubmit={handleSubmit} className="inline-form" aria-label="Run a free audit">
        <input
          className="input"
          type="text"
          inputMode="url"
          autoComplete="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourorganization.org"
          aria-label="Website address"
        />
        <button type="submit" className="btn" disabled={state.status === "loading"}>
          {state.status === "loading" ? "Running audit…" : "Run free audit"}
        </button>
      </form>

      <div aria-live="polite">
        {state.status === "error" && <div style={{ marginTop: "var(--s-5)" }}><Message text={state.message} /></div>}

        {state.status === "done" && (
          <div style={{ marginTop: "var(--s-7)" }}>
            <p className="finding-title" style={{ overflowWrap: "anywhere" }}>{state.result.url}</p>
            <p className="small">Audited {when(state.result.runAt)}</p>
            <div style={{ marginTop: "var(--s-5)" }}><Score value={state.result.score} /></div>
            <RenderCaveat />
            <div style={{ marginTop: "var(--s-6)" }}>
              <ValueSummary score={state.result.score} items={state.result.checks}>
                <a className="btn" href={signupFor(state.result)} onClick={() => track("connect_cta_clicked", state.result.url)}>
                  {state.result.checks.some((c) => !c.passed) ? "Create an account to fix them" : "Create an account to keep watch"}
                </a>
                <span className="small">Takes about a minute.</span>
              </ValueSummary>
            </div>
            <div style={{ marginTop: "var(--s-6)" }}>
              <FindingList items={state.result.checks} fix={() => fixLink(state.result)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

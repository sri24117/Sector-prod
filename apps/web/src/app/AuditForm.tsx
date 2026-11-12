"use client";

// Slice 1 v1: see docs/plans/feature-spec-slice1-audit-funnel-v1.md.
// Calls apps/api's POST /audit directly; nothing here is persisted.
//
// Presentation (2026-10-27): the result is a summary card, then one card per finding with the
// highest-impact one open. One staggered reveal when a result lands; disclosures open in place.
// The free audit carries no organization name and no session, so the proposed schema block is
// shown on the signed-in result instead of here.

import { useState } from "react";
import { AdGrantsBenchmarkCard, AuditMap, AuditSummary, JourneySteps, Message, RenderCaveat, when, type FindingLike } from "../lib/ui";
import { track } from "../lib/api";

interface AuditResult { url: string; score: number; runAt: string; checks: FindingLike[] }
type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string; fieldError: boolean }
  | { status: "done"; result: AuditResult };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export default function AuditForm() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeUrl(url);

    if (!normalized) {
      setState({
        status: "error",
        message: "Check the website address and try again. You can enter it as yourorganization.org.",
        fieldError: true,
      });
      return;
    }

    setState({ status: "loading" });
    try {
      const res = await fetch(`${API_URL}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setState({
          status: "error",
          message: body?.message ?? "Could not run that audit. Check the address and try again.",
          fieldError: false,
        });
        return;
      }
      setState({ status: "done", result: (await res.json()) as AuditResult });
    } catch {
      setState({
        status: "error",
        message: "Could not reach the audit service. Check your connection and try again.",
        fieldError: false,
      });
    }
  }

  // Connect-intent signal for the funnel (feature-spec-slice1): recorded, then the visitor
  // goes to signup with the audited site carried over.
  const signupFor = (r: AuditResult) => `/signup?url=${encodeURIComponent(r.url)}`;
  const fixLink = (r: AuditResult) => (
    <a href={signupFor(r)} onClick={() => track("fix_clicked", r.url)}>Create an account to fix this</a>
  );
  const fieldError = state.status === "error" && state.fieldError;

  return (
    <div>
      <JourneySteps current={state.status === "done" ? 2 : 1} />
      <form onSubmit={handleSubmit} className="inline-form audit-form" aria-label="Run a free audit" noValidate>
        <label className="field-label audit-field-label" htmlFor="audit-url">Website address</label>
        <input
          className="input"
          type="text"
          inputMode="url"
          autoComplete="url"
          id="audit-url"
          value={url}
          aria-invalid={fieldError || undefined}
          aria-describedby={`audit-url-hint${fieldError ? " audit-url-error" : ""}`}
          onChange={(e) => {
            setUrl(e.target.value);
            if (state.status === "error" || state.status === "done") {
              setState({ status: "idle" });
            }
          }}
          placeholder="yourorganization.org"
        />
        <button type="submit" className="btn" disabled={state.status === "loading"}>
          {state.status === "loading" ? "Running audit…" : "Run free audit"}
        </button>
        <p id="audit-url-hint" className="small audit-field-hint">
          Use a public website address. Do not enter a password or private link.
        </p>
      </form>

      <div aria-live="polite">
        {state.status === "error" && (
          <div id={fieldError ? "audit-url-error" : undefined} style={{ marginTop: "var(--s-5)" }}>
            <Message text={state.message} />
          </div>
        )}

        {state.status === "loading" && (
          <p className="small audit-loading" role="status">Checking the public pages. This may take a few seconds.</p>
        )}

        {state.status === "done" && (() => {
          const { result } = state;
          const failing = result.checks.filter((c) => !c.passed);
          return (
            <div style={{ marginTop: "var(--s-7)" }}>
              <AuditSummary
                url={result.url}
                audited={when(result.runAt)}
                score={result.score}
                items={result.checks}
                fresh
              />

              <RenderCaveat />

              <div style={{ marginTop: "var(--s-6)" }}>
                <AuditMap items={result.checks} fix={() => fixLink(result)} />
              </div>

              <div className="actions" style={{ marginTop: "var(--s-6)" }}>
                <a className="btn btn-quiet" href={signupFor(result)} onClick={() => track("connect_cta_clicked", result.url)}>
                  {failing.length ? "Create an account to fix these" : "Create an account to keep watch"}
                </a>
                <span className="small">Takes about a minute.</span>
              </div>

              <div style={{ marginTop: "var(--s-6)" }}>
                <AdGrantsBenchmarkCard />
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

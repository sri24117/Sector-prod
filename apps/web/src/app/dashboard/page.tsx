"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { AppShell, FindingList, Mark, RenderCaveat, when, type FindingLike, type Me } from "../../lib/ui";
import { checkCopy, pointsFor } from "../../lib/checks";
import { normalizePlan, PLAN_NAMES } from "@sector/shared/plans";

interface NextStep { title: string; body: string; href: string; label: string }

/** Spec 2026-10-04 section 4: exactly one next action, chosen deterministically from real state. */
function nextStepFor(audits: Audit[], findings: FindingLike[] | null, connected: boolean): NextStep {
  if (audits.length === 0) return { title: "Run your first audit", body: "It takes a few seconds and shows exactly what to fix, in plain words.", href: "/audits", label: "Run your first audit" };
  const failing = (findings ?? []).filter((f) => !f.passed).sort((a, b) => pointsFor(b) - pointsFor(a));
  const schema = failing.find((f) => f.checkId === "schema");
  if (schema && !connected) return { title: "Connect WordPress for supported improvements", body: "Once connected, SEctOr adds the missing organization details to your site for you and re-checks it.", href: "/audits#wordpress", label: "Connect WordPress" };
  if (schema && connected) return { title: "Review your first website improvement", body: "Your WordPress site is connected. Review the target and organization details before approving the change.", href: "/audits", label: "Review the change" };
  const top = failing[0];
  if (top) return { title: `Fix: ${checkCopy(top.checkId).title} (+${pointsFor(top)} points)`, body: `${checkCopy(top.checkId).effort}. The Audits page has the steps.`, href: "/audits", label: "Show me how" };
  return { title: "Re-check your site", body: "Every check passes. Sites change over time, so run an audit now and then to keep it that way.", href: "/audits", label: "Run a new audit" };
}

function changeLine(audits: Audit[]): string {
  if (audits.length < 2) return "Run another audit to start tracking progress.";
  const [now, before] = audits as [Audit, Audit];
  const d = now.score - before.score;
  const date = new Date(before.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  if (d > 0) return `+${d} points increase since ${date}`;
  if (d < 0) return `${d} points since ${date}`;
  return `Score stable since ${date}`;
}

interface Audit { id: string; url: string; score: number; createdAt: string }
interface Alert { id: string; ruleId: string; message: string }

function Overview({ me }: { me: Me }) {
  const [audits, setAudits] = useState<Audit[] | null>(null);
  const [latest, setLatest] = useState<FindingLike[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | "unavailable" | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    api<Audit[]>("/audits").then(async (list) => {
      setAudits(list);
      if (list[0]) setLatest(((await api(`/audits/${list[0].id}`)) as { findings: FindingLike[] }).findings);
    }).catch(() => setAudits([]));
    api("/connections/wordpress").then(() => setConnected(true)).catch(() => setConnected(false));
    api<Alert[]>("/ad-grants/alerts").then(setAlerts)
      .catch((e) => setAlerts(e instanceof ApiError && e.status === 403 ? "unavailable" : []));
  }, []);

  const last = audits?.[0];
  const passedCount = latest?.filter((f) => f.passed).length ?? 0;
  const attention = latest?.filter((f) => !f.passed).length ?? 0;
  const totalChecks = (latest?.length && latest.length > 0) ? latest.length : 7;
  const planName = PLAN_NAMES[normalizePlan(me.plan)];

  return (
    <div>
      {/* Dashboard Page Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--s-4)", marginBottom: "var(--s-6)" }}>
        <div>
          <h1 className="headline">Dashboard</h1>
          <p className="muted prose" style={{ marginTop: "var(--s-1)", fontSize: "14px" }}>
            Welcome back, <strong>{me.name}</strong>. Here is your NGO&apos;s digital search health and compliance overview.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--s-3)" }}>
          <a href="/audits" className="btn btn-quiet" style={{ fontSize: "13px" }}>
            View Full Audits
          </a>
          <a href="/" className="btn" style={{ fontSize: "13px" }}>
            Run New Audit
          </a>
        </div>
      </div>

      {/* 4-Column Modular Metric Cards Row */}
      <div className="metrics-grid">
        {/* Metric 1: Featured Emerald Card - Overall Health Score */}
        <div className="metric-card metric-card-featured">
          <div className="metric-header">
            <span className="metric-title">Overall Score</span>
            <span className="metric-badge-icon" aria-hidden="true">↗</span>
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">{last ? last.score : "—"}</span>
            <span style={{ fontSize: "14px", opacity: 0.85, marginLeft: "4px" }}>/ 100</span>
          </div>
          <div className="metric-footer">
            <span className="metric-trend-up">
              {audits && audits.length > 0 ? changeLine(audits) : "No audits yet"}
            </span>
          </div>
        </div>

        {/* Metric 2: Checks Passed */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Search & AI Checks</span>
            <span className="metric-badge-icon" style={{ background: "rgba(22, 134, 83, 0.08)", color: "var(--status-success)" }}>
              ✓
            </span>
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">{last ? `${passedCount}/${totalChecks}` : "—"}</span>
          </div>
          <div className="metric-footer">
            {attention > 0 ? (
              <span style={{ color: "var(--status-warning)", fontWeight: 500 }}>
                • {attention} {attention === 1 ? "check needs" : "checks need"} attention
              </span>
            ) : (
              <span style={{ color: "var(--status-success)" }}>All monitored checks pass</span>
            )}
          </div>
        </div>

        {/* Metric 3: Plan & Drafting */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Content Studio</span>
            <a href="/plan" className="metric-badge-icon" title="View plan details" style={{ textDecoration: "none" }}>
              ⚡
            </a>
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value" style={{ fontSize: "24px", paddingTop: "6px" }}>{planName}</span>
          </div>
          <div className="metric-footer">
            <span>DPDP Consent Gated Comms</span>
          </div>
        </div>

        {/* Metric 4: Ad Grants & FCRA */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Google Ad Grants</span>
            <a href="/ad-grants" className="metric-badge-icon" style={{ color: "var(--status-info)", textDecoration: "none" }}>
              ⓘ
            </a>
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value" style={{ fontSize: "20px", paddingTop: "8px" }}>
              {alerts === "unavailable" ? "FCRA Check" : Array.isArray(alerts) ? (alerts.length === 0 ? "Compliant" : `${alerts.length} Alerts`) : "Monitoring"}
            </span>
          </div>
          <div className="metric-footer">
            {alerts === "unavailable" ? (
              <span className="muted">Pending MHA Ops review</span>
            ) : Array.isArray(alerts) && alerts.length > 0 ? (
              <span style={{ color: "var(--status-warning)" }}>Attention required</span>
            ) : (
              <span style={{ color: "var(--status-success)" }}>Rules verified</span>
            )}
          </div>
        </div>
      </div>

      {/* Main 2-Column Dashboard Body */}
      <div className="columns">
        {/* Left Column (Primary Tasks & Wins) */}
        <div>
          {audits === null && <p className="muted" role="status">Loading dashboard information…</p>}

          {/* Next Action Priority Card */}
          {audits !== null && (audits.length === 0 || latest !== null) && (() => {
            const step = nextStepFor(audits, latest, connected);
            return (
              <section
                className="card"
                aria-labelledby="next-step-title"
                style={{
                  marginBottom: "var(--s-6)",
                  borderLeft: "4px solid var(--emerald)",
                  background: "var(--surface)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--s-2)" }}>
                  <span className="small" style={{ fontWeight: 600, color: "var(--emerald)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    Recommended Next Action
                  </span>
                  <span className="chip chip-win" style={{ fontSize: "11px", padding: "1px 8px" }}>
                    Priority Win
                  </span>
                </div>
                <h2 className="next-step-title" id="next-step-title" style={{ fontSize: "19px", marginTop: "var(--s-1)" }}>
                  {step.title}
                </h2>
                <p className="muted prose" style={{ marginTop: "var(--s-2)", fontSize: "13.5px" }}>
                  {step.body}
                </p>
                <div className="actions" style={{ marginTop: "var(--s-4)" }}>
                  <a className="btn" href={step.href}>
                    {step.label}
                  </a>
                </div>
              </section>
            );
          })()}

          {/* Latest Audit Overview Card */}
          {last && (
            <div className="card" style={{ marginBottom: "var(--s-6)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--s-3)" }}>
                <div>
                  <h2 className="section-heading" style={{ fontSize: "17px" }}>Latest Audit Details</h2>
                  <p className="small muted" style={{ marginTop: "2px" }}>
                    Domain: <strong>{last.url}</strong> · Audited {when(last.createdAt)}
                  </p>
                </div>
                <a href="/audits" className="small" style={{ fontWeight: 600 }}>
                  View All Checks →
                </a>
              </div>

              <RenderCaveat />

              <p className="prose" style={{ marginTop: "var(--s-4)", fontSize: "13.5px" }}>
                {attention === 0
                  ? "Every check passed on your latest audit. Your website schema, headings, and AI readability conform to standard."
                  : `${attention} ${attention === 1 ? "check needs" : "checks need"} attention. Fix the highest-point improvements first to boost discovery across search engines and AI assistants.`}
              </p>

              {latest && attention > 0 && (() => {
                const top = latest.filter((x) => !x.passed).sort((x, y) => pointsFor(y) - pointsFor(x)).slice(0, 3);
                return (
                  <div style={{ marginTop: "var(--s-5)", borderTop: "1px solid var(--line)", paddingTop: "var(--s-4)" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "var(--s-3)", color: "var(--ink)" }}>
                      Top Fixes with Highest Score Gain
                    </h3>
                    <FindingList items={top} fix={() => <a href="/audits">Fix this on the Audits page</a>} />
                    {attention > 3 && (
                      <p style={{ marginTop: "var(--s-4)", fontSize: "13px" }}>
                        <a href="/audits" style={{ fontWeight: 600 }}>
                          See all {attention} findings on the Audits page →
                        </a>
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Right Column (Score History & Organization At-A-Glance) */}
        <aside aria-label="At a glance" style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
          {/* Audit History Card */}
          <div className="card">
            <h2 className="section-heading" style={{ fontSize: "16px", marginBottom: "var(--s-3)" }}>
              Score History
            </h2>
            {audits && audits.length > 0 ? (
              <ul className="rows" style={{ margin: 0 }}>
                {audits.slice(0, 5).map((a) => (
                  <li key={a.id} style={{ padding: "var(--s-2) 0" }}>
                    <span className="row-main">
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{a.url}</span>
                      <br />
                      <span className="small muted">{when(a.createdAt)}</span>
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        background: a.score >= 70 ? "rgba(8, 122, 80, 0.1)" : "rgba(23, 26, 25, 0.08)",
                        color: a.score >= 70 ? "var(--emerald)" : "var(--ink)",
                      }}
                    >
                      {a.score}/100
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Scores appear here after your first audit.</p>
            )}
          </div>

          {/* Organization & Setup Summary Card */}
          <div className="card">
            <h2 className="section-heading" style={{ fontSize: "16px", marginBottom: "var(--s-3)" }}>
              Organization Summary
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)", fontSize: "13px" }}>
              <div>
                <span className="muted small" style={{ display: "block" }}>Organization</span>
                <strong>{me.organizationName}</strong>
              </div>
              <div>
                <span className="muted small" style={{ display: "block" }}>Primary Website</span>
                <span>{me.websiteUrl || last?.url || "Not configured"}</span>
              </div>
              <div>
                <span className="muted small" style={{ display: "block" }}>Active Tier</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <strong>{planName}</strong>
                  <a href="/plan" className="small" style={{ fontWeight: 600 }}>Change →</a>
                </span>
              </div>
              <div>
                <span className="muted small" style={{ display: "block" }}>Account Role</span>
                <span>{me.role.charAt(0).toUpperCase() + me.role.slice(1)}</span>
              </div>
            </div>
          </div>

          {/* Ad Grants Status Card */}
          <div className="card">
            <h2 className="section-heading" style={{ fontSize: "16px", marginBottom: "var(--s-2)" }}>
              Google Ad Grants
            </h2>
            <div style={{ fontSize: "13px" }}>
              {alerts === null && <p className="small muted">Checking compliance…</p>}
              {alerts === "unavailable" && (
                <p className="small muted">
                  Available once your FCRA registration is confirmed by SEctOr operations.
                </p>
              )}
              {Array.isArray(alerts) && alerts.length === 0 && (
                <p className="small" style={{ color: "var(--status-success)" }}>
                  ✓ No open compliance alerts on record.
                </p>
              )}
              {Array.isArray(alerts) && alerts.length > 0 && (
                <p className="notice notice-attention" style={{ marginTop: "var(--s-2)" }}>
                  <Mark passed={false} />
                  <span>
                    <a href="/ad-grants" style={{ fontWeight: 600 }}>
                      {alerts.length} open {alerts.length === 1 ? "alert" : "alerts"}
                    </a>{" "}
                    need attention.
                  </span>
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      {(me) => <Overview me={me} />}
    </AppShell>
  );
}

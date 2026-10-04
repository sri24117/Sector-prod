"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { AppShell, FindingList, Mark, RenderCaveat, Score, potentialScore, when, type FindingLike } from "../../lib/ui";
import { checkCopy, pointsFor } from "../../lib/checks";

interface NextStep { title: string; body: string; href: string; label: string }

/** Spec 2026-10-04 section 4: exactly one next action, chosen deterministically from real state. */
function nextStepFor(audits: Audit[], findings: FindingLike[] | null, connected: boolean): NextStep {
  if (audits.length === 0) return { title: "Run your first audit", body: "It takes a few seconds and shows exactly what to fix, in plain words.", href: "/audits", label: "Run your first audit" };
  const failing = (findings ?? []).filter((f) => !f.passed).sort((a, b) => pointsFor(b) - pointsFor(a));
  const schema = failing.find((f) => f.checkId === "schema");
  if (schema && !connected) return { title: `Connect WordPress (+${pointsFor(schema)} points)`, body: "Once connected, SEctOr adds the missing organization details to your site for you and re-checks it.", href: "/audits#wordpress", label: "Connect WordPress" };
  if (schema && connected) return { title: `Apply your first fix (+${pointsFor(schema)} points)`, body: "Your WordPress site is connected. One click adds the missing organization details and re-checks your score.", href: "/audits", label: "Apply the fix" };
  const top = failing[0];
  if (top) return { title: `Fix: ${checkCopy(top.checkId).title} (+${pointsFor(top)} points)`, body: `${checkCopy(top.checkId).effort}. The Audits page has the steps.`, href: "/audits", label: "Show me how" };
  return { title: "Re-check your site", body: "Every check passes. Sites change over time, so run an audit now and then to keep it that way.", href: "/audits", label: "Run a new audit" };
}

function changeLine(audits: Audit[]): string {
  if (audits.length < 2) return "Run another audit after your fixes to see your progress here.";
  const [now, before] = audits as [Audit, Audit];
  const d = now.score - before.score;
  const date = new Date(before.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  if (d > 0) return `Up ${d} points since ${date}.`;
  if (d < 0) return `Down ${-d} points since ${date}. Check what changed on the Audits page.`;
  return `Same score as on ${date}.`;
}

interface Audit { id: string; url: string; score: number; createdAt: string }
interface Alert { id: string; ruleId: string; message: string }

function Overview() {
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
  const attention = latest?.filter((f) => !f.passed).length ?? 0;

  return (
    <div className="columns">
      <div>
        {audits === null && <p className="muted" role="status">Loading your latest audit…</p>}
        {audits !== null && (audits.length === 0 || latest !== null) && (() => {
          const step = nextStepFor(audits, latest, connected);
          return (
            <section className="card next-step" aria-labelledby="next-step-title" style={{ marginBottom: "var(--s-7)" }}>
              <p className="next-step-label">Your next step</p>
              <h2 className="next-step-title" id="next-step-title">{step.title}</h2>
              <p className="muted prose" style={{ marginTop: "var(--s-2)" }}>{step.body}</p>
              <div className="actions"><a className="btn" href={step.href}>{step.label}</a></div>
              {audits.length > 0 && <p className="small" style={{ marginTop: "var(--s-4)" }}>{changeLine(audits)}</p>}
            </section>
          );
        })()}
        {last && (
          <>
            <h1 className="headline" style={{ marginBottom: "var(--s-4)" }}>Latest audit</h1>
            <p className="finding-title" style={{ overflowWrap: "anywhere" }}>{last.url}</p>
            <p className="small">Audited {when(last.createdAt)}</p>
            <div style={{ marginTop: "var(--s-5)" }}><Score value={last.score} animate={false} /></div>
            <RenderCaveat />
            <p className="prose" style={{ marginTop: "var(--s-5)" }}>
              {attention === 0 ? "Every check passed on the latest audit." : `${attention} ${attention === 1 ? "check needs" : "checks need"} attention. Fixing them could take you to ${potentialScore(last.score, latest ?? [])}.`}
            </p>
            {latest && attention > 0 && (() => {
              // Top three wins only; the full list lives on the Audits page.
              const top = latest.filter((x) => !x.passed).sort((x, y) => pointsFor(y) - pointsFor(x)).slice(0, 3);
              return (
                <div className="section">
                  <h2 className="section-heading">{attention > 3 ? "Your biggest wins" : "What to fix"}</h2>
                  <FindingList items={top} fix={() => <a href="/audits">Fix this on the Audits page</a>} />
                  {attention > 3 && <p style={{ marginTop: "var(--s-4)" }}><a href="/audits">See all {attention} on the Audits page</a></p>}
                </div>
              );
            })()}
          </>
        )}
      </div>

      <aside aria-label="At a glance" className="stack-5">
        <div>
          <h2 className="section-heading">Recent scores</h2>
          {audits && audits.length > 0 ? (
            <ul className="rows" style={{ marginTop: "var(--s-3)" }}>
              {audits.slice(0, 5).map((a) => (
                <li key={a.id}><span className="row-main">{a.url}<br /><span className="small">{when(a.createdAt)}</span></span><span className="row-score">{a.score}</span></li>
              ))}
            </ul>
          ) : <p className="small" style={{ marginTop: "var(--s-2)" }}>Scores appear here after your first audit.</p>}
        </div>
        <div>
          <h2 className="section-heading">Ad Grants</h2>
          <div style={{ marginTop: "var(--s-2)" }}>
            {alerts === null && <p className="small">Checking…</p>}
            {alerts === "unavailable" && <p className="small">Available once your FCRA registration has been confirmed by SEctOr.</p>}
            {Array.isArray(alerts) && alerts.length === 0 && <p className="small">No open compliance alerts.</p>}
            {Array.isArray(alerts) && alerts.length > 0 && (
              <p className="notice notice-attention"><Mark passed={false} />
                <span><a href="/ad-grants">{alerts.length} open {alerts.length === 1 ? "alert" : "alerts"}</a> need attention.</span>
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function DashboardPage() {
  return <AppShell>{() => <Overview />}</AppShell>;
}

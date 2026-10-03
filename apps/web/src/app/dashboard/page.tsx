"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { AppShell, FindingList, Mark, RenderCaveat, Score, when, type FindingLike } from "../../lib/ui";

interface Audit { id: string; url: string; score: number; createdAt: string }
interface Alert { id: string; ruleId: string; message: string }

function Overview() {
  const [audits, setAudits] = useState<Audit[] | null>(null);
  const [latest, setLatest] = useState<FindingLike[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | "unavailable" | null>(null);

  useEffect(() => {
    api<Audit[]>("/audits").then(async (list) => {
      setAudits(list);
      if (list[0]) setLatest(((await api(`/audits/${list[0].id}`)) as { findings: FindingLike[] }).findings);
    }).catch(() => setAudits([]));
    api<Alert[]>("/ad-grants/alerts").then(setAlerts)
      .catch((e) => setAlerts(e instanceof ApiError && e.status === 403 ? "unavailable" : []));
  }, []);

  const last = audits?.[0];
  const attention = latest?.filter((f) => !f.passed).length ?? 0;

  return (
    <div className="columns">
      <div>
        {audits === null && <p className="muted" role="status">Loading your latest audit…</p>}
        {audits?.length === 0 && (
          <div className="stack-4">
            <h1 className="headline">Start with an audit</h1>
            <p className="muted prose">
              An audit checks how easily search engines and AI assistants can find and understand your website.
              It takes a few seconds and shows exactly what to fix.
            </p>
            <div className="actions"><a className="btn" href="/audits">Run your first audit</a></div>
          </div>
        )}
        {last && (
          <>
            <h1 className="headline" style={{ marginBottom: "var(--s-4)" }}>Latest audit</h1>
            <p className="finding-title" style={{ overflowWrap: "anywhere" }}>{last.url}</p>
            <p className="small">Audited {when(last.createdAt)}</p>
            <div style={{ marginTop: "var(--s-5)" }}><Score value={last.score} animate={false} /></div>
            <RenderCaveat />
            <p className="prose" style={{ marginTop: "var(--s-5)" }}>
              {attention === 0 ? "Every check passed on the latest audit." : `${attention} ${attention === 1 ? "check needs" : "checks need"} attention. Each one has a fix on the Audits page.`}
            </p>
            {latest && <div className="section"><FindingList items={latest} fix={() => <a href="/audits">Fix this on the Audits page</a>} /></div>}
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

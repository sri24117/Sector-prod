"use client";
import { useCallback, useEffect, useState } from "react";
import { api, API_URL } from "../../lib/api";
import { GOOD_SCORE, Mark, Message, Section, useGuard, when, type Me } from "../../lib/ui";

// Paid full report (spec 2026-10-04-full-report-design.md): locked on the free plan,
// then prove you own the website, then create, view and download reports.

interface Verification { host: string; verified: boolean; method: string | null; metaTag: string; dnsRecord: { type: string; name: string; value: string } }
interface ReportSummary { coverage?: { homepageSpeedTest: boolean; accessibilityScan: boolean; pagesNotLoaded: number }; overall: number | null; areas: { performance: number; seo: number; accessibility: number; bestPractices: number } | null; pages: number; actions: { doFirst: number; thisMonth: number; later: number }; topActions: string[] }
interface Report { id: string; siteUrl: string; status: "queued" | "running" | "done" | "failed"; error: string | null; summary: ReportSummary | null; createdAt: string; finishedAt: string | null }

const METHOD_LABEL: Record<string, string> = { wordpress: "your WordPress connection", meta: "the code on your homepage", dns: "your DNS record" };

export function FullReport({ me, website }: { me: Me; website: string | null }) {
  const canWrite = me.role !== "viewer";
  const paid = me.plan === "pilot" || me.plan === "paid";
  const [ver, setVer] = useState<Verification | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState<"check" | "create" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const guard = useGuard((m) => { setMsg(m); if (m) setOk(null); });

  const loadReports = useCallback(async () => setReports(await api<Report[]>("/reports")), []);

  useEffect(() => {
    if (!paid || !website) return;
    void guard(async () => {
      setVer(await api<Verification>("/site-verification"));
      await loadReports();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paid, website]);

  // While a report is being prepared, check every 5 seconds.
  const working = reports.find((r) => r.status === "queued" || r.status === "running");
  const active = !!working;
  const done = reports.filter((r) => r.status === "done");
  const latest = done[0];
  const earlier = done.slice(1, 6);
  // A failure is worth showing only when it is the most recent attempt.
  const latestFailed = reports[0]?.status === "failed" ? reports[0] : undefined;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => { void loadReports().catch(() => undefined); }, 5000);
    return () => clearInterval(t);
  }, [active, loadReports]);

  const check = () => guard(async () => {
    setBusy("check");
    try {
      const r = await api<{ verified: boolean; method: string }>("/site-verification/check", { method: "POST" });
      setVer((v) => (v ? { ...v, verified: r.verified, method: r.method } : v));
      setOk(`Your website is verified through ${METHOD_LABEL[r.method] ?? r.method}. You can now create full reports.`);
    } finally { setBusy(null); }
  });

  const create = () => guard(async () => {
    setBusy("create");
    try {
      await api("/reports", { method: "POST" });
      setOk(null);
      await loadReports();
    } finally { setBusy(null); }
  });

  if (!paid) {
    return (
      <Section title="Full report" id="full-report">
        <div className="card report-card">
          <p className="insight-title">A deeper check of your whole website</p>
          <p className="prose" style={{ marginTop: "var(--s-2)" }}>
            Up to 20 pages checked for search, speed, accessibility and how your links look when shared on WhatsApp,
            LinkedIn and Facebook. You get a plain action plan and a PDF to share with your team or web person.
          </p>
          <p className="chips" style={{ marginTop: "var(--s-4)" }}><span className="chip">Paid plan</span><span className="chip">Your own website only</span></p>
          <p className="muted prose" style={{ marginTop: "var(--s-4)" }}>The full report is part of the paid plan. Ask SEctOr to upgrade your organization.</p>
          <div className="actions"><a className="btn btn-quiet" href="/sample-full-report.pdf" target="_blank" rel="noopener">See a sample report (PDF)</a></div>
        </div>
      </Section>
    );
  }

  if (!website) {
    return (
      <Section title="Full report" id="full-report">
        <p className="muted prose">Add your website above first. The full report checks your own website only.</p>
      </Section>
    );
  }

  return (
    <Section title="Full report" id="full-report">
      <Message text={msg} />
      <Message text={ok} tone="ok" />
      {ver && !ver.verified && (
        <div className="card report-card">
          <p className="insight-title">First, show us that {ver.host} is yours</p>
          <p className="prose" style={{ marginTop: "var(--s-2)" }}>
            We only create full reports for websites their owners have verified. Use any one of these, then press Check.
          </p>
          <ol className="methods" style={{ marginTop: "var(--s-4)" }}>
            <li><p><strong>Connect WordPress</strong> in the section below, using this same website. Nothing else is needed.</p></li>
            <li>
              <p><strong>Or add this line to your homepage</strong>, inside the &lt;head&gt; section. Your web person will know where.</p>
              <CodeLine text={ver.metaTag} label="Copy line" />
            </li>
            <li>
              <p><strong>Or add a DNS record</strong> where your domain is managed. DNS changes can take up to an hour.</p>
              <p className="small">Type <strong>{ver.dnsRecord.type}</strong>, name <strong>{ver.dnsRecord.name}</strong> (or @), value:</p>
              <CodeLine text={ver.dnsRecord.value} label="Copy value" />
            </li>
          </ol>
          {canWrite && (
            <div className="actions">
              <button type="button" className="btn" disabled={busy === "check"} onClick={() => void check()}>{busy === "check" ? "Checking…" : "Check"}</button>
            </div>
          )}
        </div>
      )}

      {ver?.verified && (
        <>
          <p className="notice notice-ok"><Mark passed /><span>{ver.host} is verified. You can create a report whenever you like.</span></p>
          {working ? <PreparingCard report={working} /> : latestFailed ? (
            <div className="card report-card report-card-failed" role="status">
              <p className="insight-title">The last report could not finish</p>
              <p className="prose">{latestFailed.error ?? "Something went wrong. Try again."}</p>
              <p className="small">{when(latestFailed.createdAt)}</p>
            </div>
          ) : null}
          {latest && !working && <LatestReportCard report={latest} />}
          {canWrite && !working && (
            <div className="actions">
              <button type="button" className={latest ? "btn btn-quiet" : "btn"} disabled={busy === "create"} onClick={() => void create()}>
                {busy === "create" ? "Starting…" : latest ? "Create a new report" : "Create your first full report"}
              </button>
              <span className="small">Takes about 2 to 4 minutes. Up to 10 a day.</span>
            </div>
          )}
          {earlier.length > 0 && (
            <>
              <p className="small insights-passed-label">Earlier reports</p>
              <ul className="rows">
                {earlier.map((r) => (
                  <li key={r.id}>
                    <span className="row-main">
                      {r.summary?.overall != null && <span className="row-score">{r.summary.overall}</span>}
                      <span style={{ marginLeft: "var(--s-3)" }}>{r.summary?.pages ?? 0} pages checked</span>
                      <br /><span className="small">{when(r.createdAt)}</span>
                    </span>
                    <span className="chips">
                      <a className="btn-link" href={`${API_URL}/reports/${r.id}/html`} target="_blank" rel="noopener">View</a>
                      <a className="btn-link" href={`${API_URL}/reports/${r.id}/pdf`}>PDF</a>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Section>
  );
}

const AREAS: { key: keyof NonNullable<ReportSummary["areas"]>; label: string }[] = [
  { key: "performance", label: "Speed" }, { key: "seo", label: "Search basics" },
  { key: "accessibility", label: "Accessibility" }, { key: "bestPractices", label: "Good practice" },
];

/** The newest finished report: its score, the four areas, the first fixes, and the two ways to open it. */
function LatestReportCard({ report: r }: { report: Report }) {
  const s = r.summary;
  return (
    <article className="card report-card" aria-labelledby={`report-${r.id}`}>
      <div className="report-head">
        <div>
          <p className="next-step-label">Latest full report · {when(r.createdAt)}</p>
          <h3 className="next-step-title" id={`report-${r.id}`}>{s ? `${s.pages} pages checked` : "Your report is ready"}</h3>
        </div>
        {s?.overall != null && (
          <p className="report-score" aria-label={`Overall ${s.overall} out of 100`}>
            <span className="report-score-num" data-good={s.overall >= GOOD_SCORE ? "" : undefined}>{s.overall}</span>
            <span className="small">out of 100</span>
          </p>
        )}
      </div>
      {s?.areas && (
        <dl className="area-grid">
          {AREAS.map((a) => (
            <div key={a.key} className="area">
              <dt className="small">{a.label}</dt>
              <dd className="area-num" data-good={s.areas![a.key] >= GOOD_SCORE ? "" : undefined}>{s.areas![a.key]}</dd>
            </div>
          ))}
        </dl>
      )}
      {s?.coverage && (!s.coverage.homepageSpeedTest || !s.coverage.accessibilityScan) && (
        <p className="notice notice-attention"><Mark passed={false} /><span>Some checks could not run this time{!s.coverage.homepageSpeedTest ? ", including the speed test, so there is no overall score" : ""}. The report lists what is missing; creating a new report usually completes them.</span></p>
      )}
      {s && s.topActions.length > 0 && (
        <div className="report-fixes">
          <p className="finding-title">{s.actions.doFirst ? "Do these first" : "Your next fixes"}</p>
          <ol className="finding-steps">{s.topActions.map((t) => <li key={t}>{t}</li>)}</ol>
          <p className="chips">
            <span className="chip">{s.actions.doFirst} do first</span>
            <span className="chip">{s.actions.thisMonth} this month</span>
            <span className="chip">{s.actions.later} later</span>
          </p>
        </div>
      )}
      <div className="actions">
        <a className="btn" href={`${API_URL}/reports/${r.id}/html`} target="_blank" rel="noopener">View full report</a>
        <a className="btn btn-quiet" href={`${API_URL}/reports/${r.id}/pdf`}>Download PDF</a>
      </div>
    </article>
  );
}

/** Honest progress: what is happening and for how long, never an invented percentage. */
function PreparingCard({ report: r }: { report: Report }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = Math.max(0, Math.round((now - new Date(r.createdAt).getTime()) / 1000));
  const elapsed = secs < 60 ? `${secs} seconds` : `${Math.floor(secs / 60)} min ${secs % 60} s`;
  return (
    <div className="card report-card" role="status" aria-live="polite">
      <p className="insight-title">{r.status === "queued" ? "Your report is about to start" : "Checking your website"}</p>
      <p className="prose">We are reading up to 20 pages, testing speed on a phone, checking accessibility and how your links look when shared.</p>
      <div className="progress" aria-hidden="true"><span /></div>
      <p className="small">{elapsed} so far · usually about 2 to 4 minutes. You can leave this page; the report will be here when you come back.</p>
    </div>
  );
}


/** A verification code people copy into their site or DNS, with a one-click copy. */
function CodeLine({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the text stays selectable */ }
  }
  return (
    <div className="code-row">
      <code className="code-line">{text}</code>
      <button type="button" className="btn btn-quiet code-copy" onClick={() => void copy()} aria-live="polite">{copied ? "Copied" : label}</button>
    </div>
  );
}

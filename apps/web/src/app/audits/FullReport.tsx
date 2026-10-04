"use client";
import { useCallback, useEffect, useState } from "react";
import { api, API_URL } from "../../lib/api";
import { Message, Section, useGuard, when, type Me } from "../../lib/ui";

// Paid full report (spec 2026-10-04-full-report-design.md): locked on the free plan,
// then prove you own the website, then create, view and download reports.

interface Verification { host: string; verified: boolean; method: string | null; metaTag: string; dnsRecord: { type: string; name: string; value: string } }
interface ReportSummary { overall: number | null; pages: number; actions: { doFirst: number; thisMonth: number; later: number }; topActions: string[] }
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
  const active = reports.some((r) => r.status === "queued" || r.status === "running");
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
      setOk("Your report is being prepared. It usually takes 2 to 4 minutes. You can stay on this page or come back later.");
      await loadReports();
    } finally { setBusy(null); }
  });

  if (!paid) {
    return (
      <Section title="Full report" id="full-report">
        <div className="card">
          <p className="insight-title">A deeper check of your whole website</p>
          <p className="prose" style={{ marginTop: "var(--s-2)" }}>
            Up to 20 pages checked for search, speed, accessibility and how your links look when shared on WhatsApp,
            LinkedIn and Facebook. You get a plain action plan and a PDF to share with your team or web person.
          </p>
          <p className="chips" style={{ marginTop: "var(--s-4)" }}><span className="chip">Paid plan</span><span className="chip">Your own website only</span></p>
          <p className="muted prose" style={{ marginTop: "var(--s-4)" }}>The full report is part of the paid plan. Ask SEctOr to upgrade your organization.</p>
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
        <div className="card">
          <p className="insight-title">First, show us that {ver.host} is yours</p>
          <p className="prose" style={{ marginTop: "var(--s-2)" }}>
            We only create full reports for websites their owners have verified. Use any one of these, then press Check.
          </p>
          <ol className="methods" style={{ marginTop: "var(--s-4)" }}>
            <li><p><strong>Connect WordPress</strong> in the section below, using this same website. Nothing else is needed.</p></li>
            <li>
              <p><strong>Or add this line to your homepage</strong>, inside the &lt;head&gt; section. Your web person will know where.</p>
              <code className="code-line">{ver.metaTag}</code>
            </li>
            <li>
              <p><strong>Or add a DNS record</strong> where your domain is managed. DNS changes can take up to an hour.</p>
              <code className="code-line">Type: {ver.dnsRecord.type} · Name: {ver.dnsRecord.name} · Value: {ver.dnsRecord.value}</code>
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
          <p className="notice notice-ok"><span>{ver.host} is verified. Reports take 2 to 4 minutes to prepare.</span></p>
          {canWrite && (
            <div className="actions">
              <button type="button" className="btn" disabled={busy === "create" || active} onClick={() => void create()}>
                {active ? "Preparing your report…" : busy === "create" ? "Starting…" : "Create full report"}
              </button>
            </div>
          )}
        </>
      )}

      {reports.length > 0 && (
        <ul className="rows" style={{ marginTop: "var(--s-5)" }}>
          {reports.map((r) => (
            <li key={r.id}>
              <span className="row-main">
                {r.status === "done" && r.summary?.overall != null && <span className="row-score">{r.summary.overall}</span>}{" "}
                <span style={{ marginLeft: r.status === "done" ? "var(--s-3)" : 0 }}>{statusWords(r)}</span>
                <br /><span className="small">{when(r.createdAt)}</span>
                {r.status === "failed" && r.error && <><br /><span className="small">{r.error}</span></>}
              </span>
              {r.status === "done" && (
                <span className="chips">
                  <a className="btn-link" href={`${API_URL}/reports/${r.id}/html`} target="_blank" rel="noopener">View report</a>
                  <a className="btn-link" href={`${API_URL}/reports/${r.id}/pdf`}>Download PDF</a>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function statusWords(r: Report): string {
  if (r.status === "queued") return "Waiting to start…";
  if (r.status === "running") return "Checking your website…";
  if (r.status === "failed") return "Could not finish";
  const a = r.summary?.actions;
  if (!a) return "Ready";
  const first = a.doFirst ? `${a.doFirst} to do first` : "nothing urgent";
  return `Ready: ${r.summary!.pages} pages checked, ${first}`;
}

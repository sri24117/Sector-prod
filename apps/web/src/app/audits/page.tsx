"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { AppShell, Field, FindingList, JourneySteps, Message, PageHead, RenderCaveat, Score, Section, ValueSummary, useGuard, when, type Me } from "../../lib/ui";

interface Audit { id: string; url: string; score: number; createdAt: string }
interface Finding { id: string; checkId: string; passed: boolean; detail: string }
interface Outcome { mode: "applied" | "manual"; status?: string; beforeScore?: number; afterScore?: number; package?: { title: string; steps: string[] } }
interface Connection { siteUrl: string; status: string }

function Audits({ me }: { me: Me }) {
  const canWrite = me.role !== "viewer";
  const [audits, setAudits] = useState<Audit[]>([]);
  const [open, setOpen] = useState<{ audit: Audit; findings: Finding[]; fresh: boolean } | null>(null);
  const [outcome, setOutcome] = useState<Record<string, Outcome>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [conn, setConn] = useState<Connection | null>(null);
  const [wp, setWp] = useState({ siteUrl: "", username: "", applicationPassword: "" });
  const guard = useGuard((m) => { setMsg(m); if (m) setOk(null); });

  const load = useCallback(async () => setAudits(await api<Audit[]>("/audits")), []);
  useEffect(() => {
    // First visit after signup (/audits?first=1): run the first audit of the org website right away.
    const first = new URLSearchParams(window.location.search).get("first") === "1";
    void guard(async () => {
      const list = await api<Audit[]>("/audits");
      setAudits(list);
      if (first && list.length === 0 && canWrite) {
        window.history.replaceState(null, "", "/audits");
        await run();
      } else if (list[0]) {
        // Open the latest results straight away: the journey continues from what they last saw.
        const r = await api<{ findings: Finding[] }>(`/audits/${list[0].id}`);
        setOpen({ audit: list[0], findings: r.findings, fresh: false });
      }
    });
    api<Connection>("/connections/wordpress").then(setConn).catch(() => setConn(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const show = (a: Audit) => guard(async () => {
    const r = await api<{ findings: Finding[] }>(`/audits/${a.id}`);
    setOpen({ audit: a, findings: r.findings, fresh: false });
  });
  const run = () => guard(async () => {
    setBusy("run");
    try {
      const r = await api<Audit & { findings: Finding[] }>("/audits", { method: "POST", body: url ? { url } : {} });
      setOpen({ audit: r, findings: r.findings, fresh: true });
      await load();
    } finally { setBusy(null); }
  });
  const connect = () => guard(async () => {
    setBusy("connect");
    try {
      const c = await api<Connection>("/connections/wordpress", { method: "POST", body: wp });
      setConn(c); setOk("WordPress is connected. Structured-data fixes can now be applied directly.");
      setWp({ siteUrl: "", username: "", applicationPassword: "" });
    } finally { setBusy(null); }
  });
  const fix = (f: Finding) => guard(async () => {
    setBusy(f.id);
    try {
      const o = await api<Outcome>(`/findings/${f.id}/remediate`, { method: "POST" });
      setOutcome((s) => ({ ...s, [f.id]: o }));
      await load();
    } finally { setBusy(null); }
  });

  // The one next action for the value card (spec section 3): connect, then apply the auto-fixable win.
  function nextAction(findings: Finding[]) {
    if (!canWrite) return null;
    const schema = findings.find((f) => f.checkId === "schema" && !f.passed && !outcome[f.id]);
    if (schema && !conn) return <a className="btn" href="#wordpress">Connect WordPress</a>;
    if (schema && conn) return <button type="button" className="btn" disabled={busy === schema.id} onClick={() => fix(schema)}>{busy === schema.id ? "Applying fix…" : "Apply the first fix"}</button>;
    return null;
  }

  function fixFor(f: Finding) {
    const o = outcome[f.id];
    if (o?.mode === "applied") {
      return <p className="notice notice-ok"><span>Fix applied ({o.status === "verified" ? "confirmed on re-check" : "not yet visible on re-check"}). Score {o.beforeScore} to {o.afterScore}.</span></p>;
    }
    if (o?.mode === "manual" && o.package) {
      return <div className="stack-2"><p className="finding-title">{o.package.title}</p><ol className="finding-steps">{o.package.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>;
    }
    if (!canWrite) return null;
    const live = f.checkId === "schema";
    if (live && !conn) return <p className="small">Connect WordPress below to apply this fix directly, or <button type="button" className="btn-link" onClick={() => fix(f)}>show me how to fix this</button>.</p>;
    return (
      <button type="button" className={live ? "btn" : "btn btn-quiet"} disabled={busy === f.id} onClick={() => fix(f)}>
        {busy === f.id ? "Working…" : live ? "Apply fix to my WordPress site" : "Show me how to fix this"}
      </button>
    );
  }

  return (
    <>
      <JourneySteps current={conn ? 4 : 3} />
      <PageHead title="Audits">Run an audit, see what needs attention, and fix it.</PageHead>
      <Message text={msg} />
      <Message text={ok} tone="ok" />

      {canWrite && (
        <Section title="Run an audit" id="run">
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); void run(); }}>
            <input className="input" inputMode="url" aria-label="Website address" placeholder="Your website, or leave blank" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button type="submit" className="btn" disabled={busy === "run"}>{busy === "run" ? "Running audit…" : "Run audit"}</button>
          </form>
        </Section>
      )}

      {open && (
        <Section title="Results" id="results">
          <p className="finding-title" style={{ overflowWrap: "anywhere" }}>{open.audit.url}</p>
          <p className="small">Audited {when(open.audit.createdAt)}</p>
          <div style={{ marginTop: "var(--s-5)" }}><Score value={open.audit.score} animate={open.fresh} /></div>
          <RenderCaveat />
          <div style={{ marginTop: "var(--s-6)" }}>
            <ValueSummary score={open.audit.score} items={open.findings}>{nextAction(open.findings)}</ValueSummary>
          </div>
          <div style={{ marginTop: "var(--s-6)" }}>
            <FindingList items={open.findings} fix={fixFor} autoFix={!!conn} />
          </div>
        </Section>
      )}

      <Section title="History" id="history">
        {audits.length === 0 ? <p className="muted">No audits yet.</p> : (
          <ul className="rows">
            {audits.map((a) => (
              <li key={a.id}>
                <span className="row-main"><span className="row-score">{a.score}</span> <span style={{ marginLeft: "var(--s-3)" }}>{a.url}</span><br /><span className="small">{when(a.createdAt)}</span></span>
                <button type="button" className="btn-link" onClick={() => show(a)}>View findings</button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="WordPress connection" id="wordpress">
        {conn ? (
          <p className="notice notice-ok"><span>Connected to <strong>{conn.siteUrl}</strong>. Structured-data fixes are applied directly to this site.</span></p>
        ) : (
          <p className="muted prose">Not connected. Connecting lets SEctOr apply structured-data fixes to your site and re-check them.</p>
        )}
        {canWrite && (
          <form style={{ marginTop: "var(--s-5)", maxWidth: 480 }} onSubmit={(e) => { e.preventDefault(); void connect(); }}>
            <p className="small prose" style={{ marginBottom: "var(--s-4)" }}>
              Install the SEctOr Companion plugin on your site, then create an Application Password for a WordPress administrator
              (Users, Profile, Application Passwords). Your password is stored encrypted and never shown again.
            </p>
            <Field label="Site address"><input className="input" inputMode="url" value={wp.siteUrl} onChange={(e) => setWp({ ...wp, siteUrl: e.target.value })} required /></Field>
            <Field label="WordPress username"><input className="input" autoComplete="off" value={wp.username} onChange={(e) => setWp({ ...wp, username: e.target.value })} required /></Field>
            <Field label="Application password"><input className="input" type="password" autoComplete="off" value={wp.applicationPassword} onChange={(e) => setWp({ ...wp, applicationPassword: e.target.value })} required /></Field>
            <div className="actions"><button type="submit" className="btn" disabled={busy === "connect"}>{busy === "connect" ? "Checking connection…" : conn ? "Reconnect WordPress" : "Connect WordPress"}</button></div>
          </form>
        )}
      </Section>
    </>
  );
}

export default function AuditsPage() {
  return <AppShell>{(me) => <Audits me={me} />}</AppShell>;
}

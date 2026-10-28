"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { hasFeature, planRequiredMessage } from "@sector/shared/plans";
import { AppShell, Field, FindingList, JourneySteps, Message, PageHead, RenderCaveat, Score, Section, ValueSummary, useGuard, when, type Me } from "../../lib/ui";
import { FullReport } from "./FullReport";

interface Audit { id: string; url: string; score: number; createdAt: string }
interface Finding { id: string; checkId: string; passed: boolean; detail: string }
interface Outcome { remediationLogId?: string; mode: "applied" | "manual"; status?: string; beforeScore?: number; afterScore?: number; package?: { title: string; steps: string[] } }
interface ChangeRecord { id: string; status: string; detail: string; payload?: { siteUrl?: string }; createdAt: string }
interface Connection { siteUrl: string; status: string }

function Audits({ me }: { me: Me }) {
  const canWrite = me.role !== "viewer";
  const canFixLive = hasFeature(me.plan, "wordpress_fix"); // WordPress connect and the schema fix are Starter and above
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [open, setOpen] = useState<{ audit: Audit; findings: Finding[]; fresh: boolean } | null>(null);
  const [outcome, setOutcome] = useState<Record<string, Outcome>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [website, setWebsite] = useState<string | null>(me.websiteUrl);
  const [editSite, setEditSite] = useState(!me.websiteUrl);
  const [siteInput, setSiteInput] = useState(me.websiteUrl ?? "");
  const [proposal, setProposal] = useState<{ id: string; siteUrl: string; previous: unknown; jsonLd: unknown; approvalToken: string } | null>(null);
  const [conn, setConn] = useState<Connection | null>(null);
  const [wp, setWp] = useState({ siteUrl: "", username: "", applicationPassword: "" });
  const guard = useGuard((m) => { setMsg(m); if (m) setOk(null); });

  const load = useCallback(async () => { setAudits(await api<Audit[]>("/audits")); setChanges(await api<ChangeRecord[]>("/remediations")); }, []);
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
    api<ChangeRecord[]>("/remediations").then(setChanges).catch(() => undefined);
    api<Connection>("/connections/wordpress").then(setConn).catch(() => setConn(null));
    // Initial load is intentionally performed once.
  }, []);

  const show = (a: Audit) => guard(async () => {
    const r = await api<{ findings: Finding[] }>(`/audits/${a.id}`);
    setOpen({ audit: a, findings: r.findings, fresh: false });
  });
  const run = () => guard(async () => {
    setBusy("run");
    try {
      const r = await api<Audit & { findings: Finding[] }>("/audits", { method: "POST", body: {} });
      setOpen({ audit: r, findings: r.findings, fresh: true });
      await load();
    } finally { setBusy(null); }
  });
  const saveSite = () => guard(async () => {
    setBusy("site");
    try {
      const r = await api<{ websiteUrl: string }>("/organization/profile", { method: "PATCH", body: { websiteUrl: siteInput } });
      setWebsite(r.websiteUrl); setSiteInput(r.websiteUrl); setEditSite(false);
      setOk("Website saved. Audits and full reports now check this address.");
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
  const review = (f: Finding) => guard(async () => {
    const p = await api<{ siteUrl: string; previous: unknown; jsonLd: unknown; approvalToken: string }>(`/findings/${f.id}/proposal`);
    setProposal({ id: f.id, ...p });
  });
  const fix = (f: Finding, manual = false) => guard(async () => {
    setBusy(f.id);
    try {
      const o = await api<Outcome>(`/findings/${f.id}/remediate`, { method: "POST", body: { mode: manual ? "manual" : "apply", approvalToken: proposal?.approvalToken } });
      setProposal(null);
      setOutcome((s) => ({ ...s, [f.id]: o }));
      await load();
    } finally { setBusy(null); }
  });

  // The one next action for the value card (spec section 3): connect, then apply the auto-fixable win.
  function nextAction(findings: Finding[]) {
    if (!canWrite) return null;
    const schema = findings.find((f) => f.checkId === "schema" && !f.passed && !outcome[f.id]);
    if (schema && !canFixLive) return null;
    if (schema && !conn) return <a className="btn" href="#wordpress">Connect WordPress</a>;
    if (schema && conn) return <button type="button" className="btn" disabled={busy === schema.id} onClick={() => review(schema)}>{busy === schema.id ? "Applying fix…" : "Review the first fix"}</button>;
    return null;
  }

  function fixFor(f: Finding) {
    const o = outcome[f.id];
    if (o?.mode === "applied") {
      return <div><p className="notice notice-ok"><span>{o.status === "restored" ? "Previous plugin value restored. Check your public page after refreshing any cache." : o.status === "verified" ? "Change saved and structured data detected on re-check." : "Change saved; public verification is incomplete. Check your site before applying anything else."}</span></p>{canWrite && o.remediationLogId && o.status !== "restored" && <button className="btn-link" onClick={() => { if (window.confirm(`Restore the previous Sector-managed schema on ${conn?.siteUrl}? This replaces the change just applied.`)) void guard(async () => { await api(`/remediations/${o.remediationLogId}/restore`, { method: "POST", body: { confirm: true } }); setOutcome((s) => ({ ...s, [f.id]: { ...o, status: "restored" } })); }); }}>Restore previous schema</button>}</div>;
    }
    if (o?.mode === "manual" && o.package) {
      return <div className="stack-2"><p className="finding-title">{o.package.title}</p><ol className="finding-steps">{o.package.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>;
    }
    if (!canWrite) return null;
    const live = f.checkId === "schema";
    if (live && !canFixLive) return <p className="small">{planRequiredMessage("wordpress_fix")}</p>;
    if (live && !conn) return <p className="small">Connect WordPress below to apply this fix directly, or <button type="button" className="btn-link" onClick={() => fix(f, true)}>show me how to fix this</button>.</p>;
    return (
      <button type="button" className={live ? "btn" : "btn btn-quiet"} disabled={busy === f.id} onClick={() => live ? review(f) : fix(f, true)}>
        {busy === f.id ? "Working…" : live ? "Review fix for my WordPress site" : "Show me how to fix this"}
      </button>
    );
  }

  return (
    <>
      <JourneySteps current={conn ? 4 : 3} />
      <PageHead title="Audits">Run an audit, see what needs attention, and fix it.</PageHead>
      <Message text={msg} />
      <Message text={ok} tone="ok" />
      {proposal && <Section title="Review this website change" id="proposal">
        <p>Target: <strong>{proposal.siteUrl}</strong>. Only the schema managed by the Sector Companion plugin will change. This does not guarantee search rankings.</p>
        <details><summary>Previous value</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(proposal.previous, null, 2)}</pre></details>
        <details open><summary>Proposed organization details</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(proposal.jsonLd, null, 2)}</pre></details>
        <p className="small">The previous plugin value is recorded for restoration. Check for existing schema from SEO plugins before approving.</p>
        <div className="actions"><button className="btn" disabled={busy === proposal.id} onClick={() => { const f = open?.findings.find((x) => x.id === proposal.id); if (f) void fix(f); }}>Approve and apply this change</button><button className="btn-link" onClick={() => setProposal(null)}>Cancel</button></div>
      </Section>}

      {canWrite && (
        <Section title="Run an audit" id="run">
          {editSite ? (
            <form className="inline-form" onSubmit={(e) => { e.preventDefault(); void saveSite(); }}>
              <input className="input" inputMode="url" aria-label="Your website address" placeholder="yourorganization.org" value={siteInput} onChange={(e) => setSiteInput(e.target.value)} required />
              <button type="submit" className="btn" disabled={busy === "site"}>{busy === "site" ? "Saving…" : "Save website"}</button>
              {website && <button type="button" className="btn-link" onClick={() => { setEditSite(false); setSiteInput(website); }}>Cancel</button>}
              {website && <p className="small prose" style={{ width: "100%" }}>Changing your website means verifying it again before the next full report.</p>}
            </form>
          ) : (
            <>
              <p className="prose" style={{ overflowWrap: "anywhere" }}>Your website: <strong>{website}</strong> <button type="button" className="btn-link" onClick={() => setEditSite(true)}>Change</button></p>
              <div className="actions"><button type="button" className="btn" disabled={busy === "run"} onClick={() => void run()}>{busy === "run" ? "Running audit…" : "Run audit"}</button></div>
            </>
          )}
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

      <Section title="Website change history" id="changes">
        {changes.length === 0 ? <p className="muted">Approved changes and their verification outcomes appear here.</p> : <ul className="rows">{changes.map((change) => <li key={change.id} style={{ flexWrap: "wrap" }}><div className="row-main"><p>{change.status.replaceAll("_", " ")} · {when(change.createdAt)}</p><p className="small">{change.payload?.siteUrl ?? "Website change"} · {change.detail}</p></div>{canWrite && ["verified", "applied_unverified"].includes(change.status) && <button className="btn-link" onClick={() => { if (window.confirm(`Restore the previous Sector-managed schema on ${change.payload?.siteUrl}?`)) void guard(async () => { await api(`/remediations/${change.id}/restore`, { method: "POST", body: { confirm: true } }); setOk("Previous plugin value restored. Check the public page after refreshing cache."); await load(); }); }}>Restore previous schema</button>}</li>)}</ul>}
      </Section>
      <FullReport me={me} website={website} />

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
        {!canFixLive ? (
          <p className="muted prose">{planRequiredMessage("wordpress_fix")} Manual fix steps for each finding stay available on every plan.</p>
        ) : conn ? (
          <p className="notice notice-ok"><span>Connected to <strong>{conn.siteUrl}</strong>. Structured-data fixes are applied directly to this site.</span></p>
        ) : (
          <p className="muted prose">Not connected. Connecting lets SEctOr apply structured-data fixes to your site and re-check them.</p>
        )}
        {canWrite && canFixLive && (
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

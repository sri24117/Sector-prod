"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { Nav, Section, btn, card, err, input, page } from "../../lib/ui";

interface Audit { id: string; url: string; score: number; createdAt: string }
interface Finding { id: string; checkId: string; passed: boolean; detail: string }
interface Outcome { mode: "applied" | "manual"; status?: string; beforeScore?: number; afterScore?: number; package?: { title: string; steps: string[] } }

export default function AuditsPage() {
  const router = useRouter();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [open, setOpen] = useState<{ audit: Audit; findings: Finding[] } | null>(null);
  const [outcome, setOutcome] = useState<Record<string, Outcome>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [wp, setWp] = useState({ siteUrl: "", username: "", applicationPassword: "" });

  const guard = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setMsg(null);
    try { return await fn(); } catch (e) { if (e instanceof ApiError && e.status === 401) router.push("/login"); else setMsg(e instanceof Error ? e.message : "Something went wrong."); }
  }, [router]);
  const load = useCallback(() => guard(async () => setAudits(await api<Audit[]>("/audits"))), [guard]);
  useEffect(() => { void load(); }, [load]);

  const show = (a: Audit) => guard(async () => setOpen(await api(`/audits/${a.id}`).then((r) => ({ audit: a, findings: (r as { findings: Finding[] }).findings }))));
  const run = () => guard(async () => { await api("/audits", { method: "POST", body: url ? { url } : {} }); await load(); });
  const connect = () => guard(async () => { await api("/connections/wordpress", { method: "POST", body: wp }); setMsg("WordPress connected."); setWp({ siteUrl: "", username: "", applicationPassword: "" }); });
  const fix = (f: Finding) => guard(async () => { const o = await api<Outcome>(`/findings/${f.id}/remediate`, { method: "POST" }); setOutcome((s) => ({ ...s, [f.id]: o })); await load(); });

  return (<main style={page}><Nav /><h1>Audits &amp; fixes</h1>
    {msg && <p role="alert" style={err}>{msg}</p>}
    <Section title="Run an audit">
      <input style={input} placeholder="https://yourorg.org (blank = your profile website)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <button style={btn} onClick={run}>Run audit</button></Section>
    <Section title="Connect WordPress (enables one-click fixes)">
      <p style={{ color: "#666" }}>Install the SEctOr Companion plugin, then create an Application Password for a WordPress admin.</p>
      <input style={input} placeholder="Site URL" value={wp.siteUrl} onChange={(e) => setWp({ ...wp, siteUrl: e.target.value })} />
      <input style={input} placeholder="WordPress username" value={wp.username} onChange={(e) => setWp({ ...wp, username: e.target.value })} />
      <input style={input} type="password" placeholder="Application password" value={wp.applicationPassword} onChange={(e) => setWp({ ...wp, applicationPassword: e.target.value })} />
      <button style={btn} onClick={connect}>Connect</button></Section>
    <Section title="History">
      {audits.length === 0 && <p>No audits yet.</p>}
      {audits.map((a) => <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0" }}>
        <span>{a.url} — <strong>{a.score}/100</strong> <small>{new Date(a.createdAt).toLocaleString()}</small></span><button style={btn} onClick={() => show(a)}>Findings</button></div>)}</Section>
    {open && <Section title={`Findings for ${open.audit.url} (${open.audit.score}/100)`}>
      {open.findings.map((f) => <div key={f.id} style={card}>
        <strong>{f.passed ? "✓" : "✗"} {f.checkId}</strong><div style={{ color: "#555" }}>{f.detail}</div>
        {!f.passed && !outcome[f.id] && <button style={{ ...btn, marginTop: "0.5rem" }} onClick={() => fix(f)}>{f.checkId === "schema" ? "Apply fix to my WordPress site" : "Get manual fix steps"}</button>}
        {outcome[f.id]?.mode === "applied" && <p>Applied — {outcome[f.id]!.status}. Score {outcome[f.id]!.beforeScore} → <strong>{outcome[f.id]!.afterScore}</strong>.</p>}
        {outcome[f.id]?.mode === "manual" && <div><strong>{outcome[f.id]!.package!.title}</strong><ol>{outcome[f.id]!.package!.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>}
      </div>)}</Section>}
  </main>);
}

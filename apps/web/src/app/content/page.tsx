"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { Nav, Section, btn, card, err, input, page } from "../../lib/ui";

interface Asset { id: string; kind: string; title: string; body: string; status: string; beneficiaryRefs: string[] }
interface Consent { id: string; subjectName: string; scope: string; revokedAt: string | null }

export default function ContentPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [voice, setVoice] = useState("");
  const [c, setC] = useState({ subjectName: "", scope: "story", evidenceNote: "" });
  const [g, setG] = useState({ kind: "case_study", topic: "", facts: "", beneficiaries: "" });

  const guard = useCallback(async (fn: () => Promise<void>) => {
    setMsg(null);
    try { await fn(); } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.push("/login");
      else if (e instanceof ApiError && e.body?.error === "consent_required") setMsg(`Blocked: no active consent on file for ${(e.body.missingConsentFor as string[]).join(", ")}. Record consent below, then export again.`);
      else setMsg(e instanceof Error ? e.message : "Something went wrong.");
    }
  }, [router]);
  const load = useCallback(() => guard(async () => { setAssets(await api("/content")); setConsents(await api("/consents")); }), [guard]);
  useEffect(() => { void load(); }, [load]);

  const generate = () => guard(async () => {
    const beneficiaries = g.beneficiaries.split(",").map((s) => s.trim()).filter(Boolean);
    await api("/content/generate", { method: "POST", body: { kind: g.kind, topic: g.topic, facts: g.facts.split("\n").map((s) => s.trim()).filter(Boolean), beneficiaries, noBeneficiaryIdentified: beneficiaries.length === 0 } });
    await load();
  });

  return (<main style={page}><Nav /><h1>Content &amp; consent</h1>
    {msg && <p role="alert" style={err}>{msg}</p>}
    <Section title="Brand voice">
      <textarea style={{ ...input, minHeight: 70 }} placeholder="Describe your organization's voice (10+ characters)" value={voice} onChange={(e) => setVoice(e.target.value)} />
      <button style={btn} onClick={() => guard(async () => { await api("/brand-kit", { method: "PUT", body: { voice } }); setMsg("Brand voice saved."); })}>Save</button></Section>
    <Section title="Consent on file">
      <input style={input} placeholder="Person's full name" value={c.subjectName} onChange={(e) => setC({ ...c, subjectName: e.target.value })} />
      <select style={input} value={c.scope} onChange={(e) => setC({ ...c, scope: e.target.value })}><option value="story">Story</option><option value="quote">Quote</option><option value="photo">Photo</option><option value="all">All</option></select>
      <input style={input} placeholder="How consent was obtained (e.g. signed release, date)" value={c.evidenceNote} onChange={(e) => setC({ ...c, evidenceNote: e.target.value })} />
      <button style={btn} onClick={() => guard(async () => { await api("/consents", { method: "POST", body: c }); await load(); })}>Record consent</button>
      {consents.map((x) => <div key={x.id} style={{ padding: "0.3rem 0" }}>{x.subjectName} — {x.scope} {x.revokedAt ? "(revoked)" : <button style={{ ...btn, marginLeft: 8, padding: "0.2rem 0.6rem" }} onClick={() => guard(async () => { await api(`/consents/${x.id}/revoke`, { method: "POST" }); await load(); })}>Revoke</button>}</div>)}</Section>
    <Section title="Generate a draft">
      <select style={input} value={g.kind} onChange={(e) => setG({ ...g, kind: e.target.value })}><option value="case_study">Case study</option><option value="social_post">Social post</option><option value="quote">Quote</option></select>
      <input style={input} placeholder="Topic" value={g.topic} onChange={(e) => setG({ ...g, topic: e.target.value })} />
      <textarea style={{ ...input, minHeight: 90 }} placeholder="Facts, one per line (only these will be used)" value={g.facts} onChange={(e) => setG({ ...g, facts: e.target.value })} />
      <input style={input} placeholder="Beneficiaries featured, comma-separated (blank if none)" value={g.beneficiaries} onChange={(e) => setG({ ...g, beneficiaries: e.target.value })} />
      <button style={btn} onClick={generate}>Generate draft</button></Section>
    <Section title="Drafts">
      {assets.map((a) => <div key={a.id} style={card}><strong>{a.title}</strong> <small>({a.kind} · {a.status})</small>
        {a.beneficiaryRefs.length > 0 && <div style={{ color: "#8a6d00" }}>Features: {a.beneficiaryRefs.join(", ")} — export requires consent on file.</div>}
        <p style={{ whiteSpace: "pre-wrap" }}>{a.body}</p>
        {a.status === "draft" && <button style={btn} onClick={() => guard(async () => { await api(`/content/${a.id}/approve`, { method: "POST" }); await load(); })}>Approve</button>}
        {a.status === "approved" && <button style={btn} onClick={() => guard(async () => { await api(`/content/${a.id}/export`, { method: "POST" }); await load(); })}>Export</button>}</div>)}</Section></main>);
}

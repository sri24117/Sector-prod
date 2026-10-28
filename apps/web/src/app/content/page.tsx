"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { hasFeature } from "@sector/shared/plans";
import { AppShell, Field, Message, PageHead, PlanLocked, Section, useGuard, type Me } from "../../lib/ui";

import { downloadText, type Asset } from "../../lib/content";
interface Consent { id: string; subjectName: string; scope: string; revokedAt: string | null }

const KIND: Record<string, string> = { case_study: "Case study", social_post: "Social post", quote: "Quote" };
const SCOPE: Record<string, string> = { story: "Story", quote: "Quote", photo: "Photo", all: "Everything" };
const STATUS: Record<string, string> = { draft: "Draft, waiting for approval", approved: "Approved, ready to export", exported: "Exported" };

function Content({ me }: { me: Me }) {
  const canWrite = me.role !== "viewer";
  const [assets, setAssets] = useState<Asset[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [manual, setManual] = useState(false);
  const [manualBody, setManualBody] = useState("");
  const [voice, setVoice] = useState("");
  const [c, setC] = useState({ subjectName: "", scope: "story", evidenceNote: "" });
  const [g, setG] = useState({ kind: "case_study", topic: "", facts: "", beneficiaries: "" });

  const guard = useGuard((m) => { setMsg(m); if (m) setOk(null); }, (e: ApiError) => {
    if (e.body?.error === "consent_required") {
      setMsg(`Export stopped: there is no active consent on file for ${(e.body.missingConsentFor as string[]).join(", ")}. Record their consent below, then export again.`);
      return true;
    }
    if (e.status === 501) { setMsg("Draft generation is not switched on for SEctOr yet. Everything else on this page works."); return true; }
    return false;
  });
  const load = useCallback(async () => { setAssets(await api("/content")); setConsents(await api("/consents")); }, []);
  useEffect(() => {
    void guard(load);
    api<{ voice: string }>("/brand-kit").then((k) => setVoice(k.voice)).catch(() => undefined);
    // Initial load is intentionally performed once.
  }, []);

  const act = (key: string, fn: () => Promise<void>) => guard(async () => { setBusy(key); try { await fn(); } finally { setBusy(null); } });

  const generate = () => act("generate", async () => {
    const beneficiaries = g.beneficiaries.split(",").map((s) => s.trim()).filter(Boolean);
    const facts = g.facts.split("\n").map((s) => s.trim()).filter(Boolean);
    await api(manual ? "/content" : "/content/generate", { method: "POST", body: manual
      ? { kind: g.kind, title: g.topic, body: manualBody, facts, beneficiaryRefs: beneficiaries, noBeneficiaryIdentified: beneficiaries.length === 0 }
      : { kind: g.kind, topic: g.topic, facts, beneficiaries, noBeneficiaryIdentified: beneficiaries.length === 0 } });
    setOk("Draft created. Review it below before approving.");
    await load();
  });

  return (
    <>
      <PageHead title="Content">Prepare drafts from your program facts, review the claims, and approve before export. Named beneficiaries need active consent on file.</PageHead>
      <Message text={msg} />
      <Message text={ok} tone="ok" />

      <Section title="Drafts" id="drafts">
        {assets.length === 0 ? <p className="muted">No drafts yet.</p> : (
          <div>
            {assets.map((a) => (
              <article key={a.id} className="draft">
                <h3 className="finding-title">{a.title}</h3>
                <p className="small">{KIND[a.kind] ?? a.kind}. {STATUS[a.status] ?? a.status}.</p>
                {a.beneficiaryRefs.length > 0 && (
                  <p className="small" style={{ marginTop: "var(--s-2)" }}>Features {a.beneficiaryRefs.join(", ")}. Export needs their consent on file.</p>
                )}
                {editing?.id === a.id ? <form onSubmit={(e) => { e.preventDefault(); void act(a.id, async () => {
                  await api(`/content/${a.id}`, { method: "PATCH", body: { ...editing, noBeneficiaryIdentified: editing.beneficiaryRefs.length === 0 } });
                  setEditing(null); setOk("Draft saved. Review and approve the new version before export."); await load();
                }); }}>
                  <Field label="Draft title"><input className="input" value={editing.title} maxLength={120} required onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
                  <Field label="Draft text"><textarea className="input" value={editing.body} required onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></Field>
                  <Field label="Source facts" hint="Include the source and reporting period for each claim."><textarea className="input" value={editing.facts.join("\n")} required onChange={(e) => setEditing({ ...editing, facts: e.target.value.split("\n") })} /></Field>
                  <Field label="People featured" hint="List all identifying people, separated by commas; leave empty only if nobody is identified."><input className="input" value={editing.beneficiaryRefs.join(", ")} onChange={(e) => setEditing({ ...editing, beneficiaryRefs: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></Field>
                  <p className="small">Saving resets approval. Clearing the people field declares that nobody is identified in this version.</p>
                  <div className="actions"><button className="btn" disabled={busy === a.id}>Save new version</button><button type="button" className="btn-link" onClick={() => setEditing(null)}>Cancel</button></div>
                </form> : <><p className="draft-body" style={{ marginTop: "var(--s-4)" }}>{a.body}</p>
                {a.facts?.length > 0 && <details><summary>Source facts</summary><ul>{a.facts.map((f, i) => <li key={i}>{f}</li>)}</ul></details>}
                {canWrite && <div className="actions"><button className="btn btn-quiet" onClick={() => setEditing({ ...a, facts: a.facts ?? [] })}>Edit draft</button><a className="btn-link" href={`/calendar?asset=${a.id}`}>Add to calendar</a></div>}</>}
                {canWrite && editing?.id !== a.id && a.status === "draft" && (
                  <div className="actions"><button type="button" className="btn" disabled={busy === a.id} onClick={() => act(a.id, async () => { await api(`/content/${a.id}/approve`, { method: "POST", body: { revision: a.revision } }); await load(); })}>Approve draft</button></div>
                )}
                {canWrite && editing?.id !== a.id && a.status !== "draft" && (
                  <div className="actions"><button type="button" className="btn" disabled={busy === a.id} onClick={() => act(a.id, async () => { const out = await api<{ title: string; body: string }>(`/content/${a.id}/export`, { method: "POST" }); downloadText(out.title, out.body); setOk("Downloaded. Nothing was published."); await load(); })}>Download text</button></div>
                )}
              </article>
            ))}
          </div>
        )}
      </Section>

      {canWrite && (
        <Section title="Write a new draft" id="generate">
          <label className="field"><span><input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> Write or paste a draft without AI</span></label>
          <form style={{ maxWidth: 560 }} onSubmit={(e) => { e.preventDefault(); void generate(); }}>
            <Field label="Type">
              <select className="input" value={g.kind} onChange={(e) => setG({ ...g, kind: e.target.value })}>
                {Object.entries(KIND).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Topic"><input className="input" value={g.topic} onChange={(e) => setG({ ...g, topic: e.target.value })} required /></Field>
            <Field label="Facts" hint="One per line, with source and reporting period. Check generated claims before approval.">
              <textarea className="input" value={g.facts} onChange={(e) => setG({ ...g, facts: e.target.value })} required />
            </Field>
            {manual && <Field label="Draft text"><textarea className="input" value={manualBody} onChange={(e) => setManualBody(e.target.value)} minLength={3} maxLength={20000} required /></Field>}
            <Field label="People featured" hint="Full names, separated by commas. Leave blank if no one is named.">
              <input className="input" value={g.beneficiaries} onChange={(e) => setG({ ...g, beneficiaries: e.target.value })} />
            </Field>
            <div className="actions"><button type="submit" className="btn" disabled={busy === "generate"}>{busy === "generate" ? "Saving draft…" : manual ? "Save draft" : "Write draft"}</button></div>
          </form>
        </Section>
      )}

      <Section title="Consent on file" id="consent">
        {consents.length === 0 ? <p className="muted">No consent recorded yet.</p> : (
          <ul className="rows">
            {consents.map((x) => (
              <li key={x.id}>
                <span className="row-main">{x.subjectName}<br /><span className="small">{SCOPE[x.scope] ?? x.scope}{x.revokedAt ? ", revoked" : ""}</span></span>
                {canWrite && !x.revokedAt && (
                  <button type="button" className="btn-link" disabled={busy === x.id} onClick={() => act(x.id, async () => { await api(`/consents/${x.id}/revoke`, { method: "POST" }); await load(); })}>Revoke</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canWrite && (
          <form style={{ marginTop: "var(--s-5)", maxWidth: 560 }} onSubmit={(e) => { e.preventDefault(); void act("consent", async () => { await api("/consents", { method: "POST", body: c }); setC({ subjectName: "", scope: "story", evidenceNote: "" }); setOk("Consent recorded."); await load(); }); }}>
            <Field label="Person's full name"><input className="input" value={c.subjectName} onChange={(e) => setC({ ...c, subjectName: e.target.value })} required /></Field>
            <Field label="They agreed to">
              <select className="input" value={c.scope} onChange={(e) => setC({ ...c, scope: e.target.value })}>
                {Object.entries(SCOPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="How consent was given" hint="For example: signed release form, 12 March 2026."><input className="input" value={c.evidenceNote} onChange={(e) => setC({ ...c, evidenceNote: e.target.value })} minLength={3} required /></Field>
            <div className="actions"><button type="submit" className="btn" disabled={busy === "consent"}>Record consent</button></div>
          </form>
        )}
      </Section>

      {canWrite && (
        <Section title="Brand voice" id="voice">
          <form style={{ maxWidth: 560 }} onSubmit={(e) => { e.preventDefault(); void act("voice", async () => { await api("/brand-kit", { method: "PUT", body: { voice } }); setOk("Brand voice saved."); }); }}>
            <Field label="How your organization sounds" hint="A few sentences. Drafts follow this tone.">
              <textarea className="input" value={voice} onChange={(e) => setVoice(e.target.value)} minLength={10} required />
            </Field>
            <div className="actions"><button type="submit" className="btn btn-quiet" disabled={busy === "voice"}>Save brand voice</button></div>
          </form>
        </Section>
      )}
    </>
  );
}

export default function ContentPage() {
  return <AppShell>{(me) => hasFeature(me.plan, "content") ? <Content me={me} /> : <PlanLocked feature="content" title="Content" />}</AppShell>;
}

"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { AppShell, Field, Message, PageHead, Section, useGuard, type Me } from "../../lib/ui";

interface Asset { id: string; kind: string; title: string; body: string; status: string; beneficiaryRefs: string[] }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = (key: string, fn: () => Promise<void>) => guard(async () => { setBusy(key); try { await fn(); } finally { setBusy(null); } });

  const generate = () => act("generate", async () => {
    const beneficiaries = g.beneficiaries.split(",").map((s) => s.trim()).filter(Boolean);
    await api("/content/generate", { method: "POST", body: { kind: g.kind, topic: g.topic, facts: g.facts.split("\n").map((s) => s.trim()).filter(Boolean), beneficiaries, noBeneficiaryIdentified: beneficiaries.length === 0 } });
    setOk("Draft created. Review it below before approving.");
    await load();
  });

  return (
    <>
      <PageHead title="Content">Drafts are written only from the facts you give. People named in a story need consent on file before anything is exported.</PageHead>
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
                <p className="draft-body" style={{ marginTop: "var(--s-4)" }}>{a.body}</p>
                {canWrite && a.status === "draft" && (
                  <div className="actions"><button type="button" className="btn" disabled={busy === a.id} onClick={() => act(a.id, async () => { await api(`/content/${a.id}/approve`, { method: "POST" }); await load(); })}>Approve draft</button></div>
                )}
                {canWrite && a.status === "approved" && (
                  <div className="actions"><button type="button" className="btn" disabled={busy === a.id} onClick={() => act(a.id, async () => { await api(`/content/${a.id}/export`, { method: "POST" }); setOk("Exported."); await load(); })}>Export</button></div>
                )}
              </article>
            ))}
          </div>
        )}
      </Section>

      {canWrite && (
        <Section title="Write a new draft" id="generate">
          <form style={{ maxWidth: 560 }} onSubmit={(e) => { e.preventDefault(); void generate(); }}>
            <Field label="Type">
              <select className="input" value={g.kind} onChange={(e) => setG({ ...g, kind: e.target.value })}>
                {Object.entries(KIND).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Topic"><input className="input" value={g.topic} onChange={(e) => setG({ ...g, topic: e.target.value })} required /></Field>
            <Field label="Facts" hint="One per line. The draft uses only these and invents nothing.">
              <textarea className="input" value={g.facts} onChange={(e) => setG({ ...g, facts: e.target.value })} required />
            </Field>
            <Field label="People featured" hint="Full names, separated by commas. Leave blank if no one is named.">
              <input className="input" value={g.beneficiaries} onChange={(e) => setG({ ...g, beneficiaries: e.target.value })} />
            </Field>
            <div className="actions"><button type="submit" className="btn" disabled={busy === "generate"}>{busy === "generate" ? "Writing draft…" : "Write draft"}</button></div>
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
  return <AppShell>{(me) => <Content me={me} />}</AppShell>;
}

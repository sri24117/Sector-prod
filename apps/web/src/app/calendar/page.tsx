"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { AppShell, Field, Message, PageHead, PlanLocked, Section, useGuard, type Me } from "../../lib/ui";
import { hasFeature } from "@sector/shared/plans";
import type { Asset } from "../../lib/content";

type Item = { id: string; contentAssetId: string; title: string; date: string; channel: string; objective: string; assignee: string; status: string };
const CHANNELS = { facebook: "Facebook", instagram: "Instagram", email: "Email", website: "Website", linkedin: "LinkedIn" };
const STATUS: Record<string, string> = { draft: "Draft — needs approval", ready_to_post: "Ready to post manually", consent_required: "Blocked — consent required" };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
function Calendar({ me }: { me: Me }) {
  const canWrite = me.role !== "viewer";
  const [items, setItems] = useState<Item[]>([]), [assets, setAssets] = useState<Asset[]>([]);
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [message, setMessage] = useState<string | null>(null), [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ contentAssetId: "", date: today(), channel: "facebook", objective: "", assignee: me.name });
  const guard = useGuard(setMessage);
  const load = useCallback(async () => {
    const [nextItems, nextAssets] = await Promise.all([api<Item[]>("/calendar"), api<Asset[]>("/content")]);
    setItems(nextItems); setAssets(nextAssets);
  }, []);
  useEffect(() => { void guard(async () => {
    await load(); const selected = new URLSearchParams(window.location.search).get("asset");
    if (selected) setForm((f) => ({ ...f, contentAssetId: selected }));
  }); /* Initial load is intentionally performed once. */ }, []);
  function save() { return guard(async () => {
    setBusy(true); setOk(null);
    try {
      await api(editing ? `/calendar/${editing}` : "/calendar", { method: editing ? "PATCH" : "POST", body: form });
      setMonth(form.date.slice(0, 7)); setEditing(null); setOk("Calendar saved. Nothing has been scheduled or published."); await load();
    } finally { setBusy(false); }
  }); }
  return <>
    <PageHead title="Content calendar">Plan your NGO’s communications, assign responsibility, and post approved content manually. Dates use Asia/Kolkata.</PageHead>
    <Message text={message} /><Message text={ok} tone="ok" />
    <div style={{ marginBottom: "var(--s-6)" }}><Field label="Month"><input className="input" style={{ maxWidth: 240 }} type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field></div>
    <Section title="Your plan" id="plan">
      {items.filter((i) => i.date.startsWith(month)).length === 0 ? <p className="muted">No content planned for this month. Create a draft, then choose its date and purpose.</p> : <ul className="rows">{items.filter((i) => i.date.startsWith(month)).map((i) => <li key={i.id} style={{ alignItems: "start", flexWrap: "wrap" }}>
        <div className="row-main"><p className="finding-title">{i.title}</p><p>{i.date} · {CHANNELS[i.channel as keyof typeof CHANNELS] ?? i.channel}</p><p className="small">{i.objective} · Responsible: {i.assignee}</p><p className="small">{STATUS[i.status] ?? i.status}</p><a href="/content#drafts">Open content to review or download</a></div>
        {canWrite && <div className="actions" style={{ marginTop: 0 }}><button className="btn-link" onClick={() => { setEditing(i.id); setForm({ contentAssetId: i.contentAssetId, date: i.date, channel: i.channel, objective: i.objective, assignee: i.assignee }); }}>Edit plan</button><button className="btn-link" disabled={busy} onClick={() => { if (window.confirm("Remove this calendar entry? Your content draft will stay saved.")) void guard(async () => { await api(`/calendar/${i.id}`, { method: "DELETE" }); await load(); }); }}>Remove</button></div>}
      </li>)}</ul>}
    </Section>
    {canWrite && <Section title={editing ? "Edit calendar entry" : "Plan a post"} id="add">
      {assets.length === 0 ? <p><a href="/content#generate">Create your first draft</a> before planning a post. Manual drafts work without AI.</p> : <form style={{ maxWidth: 560 }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Field label="Content draft"><select className="input" disabled={!!editing} value={form.contentAssetId} required onChange={(e) => setForm({ ...form, contentAssetId: e.target.value })}><option value="">Choose a draft</option>{assets.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select></Field>
        <Field label="Posting date"><input className="input" type="date" value={form.date} required onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Channel"><select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>{Object.entries(CHANNELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label="Objective" hint="For example: explain a program result or invite volunteer applications."><input className="input" value={form.objective} minLength={3} maxLength={300} required onChange={(e) => setForm({ ...form, objective: e.target.value })} /></Field>
        <Field label="Responsible person"><input className="input" value={form.assignee} maxLength={120} required onChange={(e) => setForm({ ...form, assignee: e.target.value })} /></Field>
        <div className="actions"><button className="btn" disabled={busy}>{busy ? "Saving…" : "Save calendar entry"}</button>{editing && <button type="button" className="btn-link" onClick={() => setEditing(null)}>Cancel editing</button>}</div>
      </form>}
    </Section>}
  </>;
}
export default function CalendarPage() { return <AppShell>{(me) => hasFeature(me.plan, "content") ? <Calendar me={me} /> : <PlanLocked feature="content" title="Content calendar" />}</AppShell>; }

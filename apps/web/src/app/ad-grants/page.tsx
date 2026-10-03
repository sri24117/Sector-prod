"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { Nav, Section, btn, card, err, input, page } from "../../lib/ui";

interface Alert { id: string; ruleId: string; metric: string; metricValue: string; threshold: string; message: string }

export default function AdGrantsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cid, setCid] = useState("");

  const guard = useCallback(async (fn: () => Promise<void>) => {
    setMsg(null);
    try { await fn(); } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.push("/login");
      else if (e instanceof ApiError && e.status === 403) setUnavailable(true);
      else setMsg(e instanceof Error ? e.message : "Something went wrong.");
    }
  }, [router]);
  const load = useCallback(() => guard(async () => setAlerts(await api<Alert[]>("/ad-grants/alerts"))), [guard]);
  useEffect(() => { void load(); }, [load]);

  if (unavailable) return (<main style={page}><Nav /><h1>Ad Grants</h1><p>Ad Grants tools are not available for this organization.</p></main>);
  return (<main style={page}><Nav /><h1>Ad Grants compliance</h1>
    {msg && <p role="alert" style={err}>{msg}</p>}
    <Section title="Link your Google Ads account">
      <input style={input} placeholder="Customer ID (123-456-7890)" value={cid} onChange={(e) => setCid(e.target.value)} />
      <button style={btn} onClick={() => guard(async () => { const r = await api<{ nextSteps: string[] }>("/ad-grants/account", { method: "POST", body: { googleCustomerId: cid } }); setMsg(r.nextSteps.join(" ")); })}>Link account</button></Section>
    <Section title="Compliance alerts">
      <button style={btn} onClick={() => guard(async () => { const r = await api<{ alerts: Alert[] }>("/ad-grants/compliance/run", { method: "POST" }); setAlerts(r.alerts); })}>Run check now</button>
      {alerts?.length === 0 && <p>No open alerts.</p>}
      {alerts?.map((a) => <div key={a.id} style={{ ...card, marginTop: "1rem" }}><strong>{a.ruleId}</strong><div>{a.message}</div>
        <small style={{ color: "#666" }}>Metric {a.metric}: {a.metricValue} (threshold {a.threshold})</small></div>)}</Section></main>);
}

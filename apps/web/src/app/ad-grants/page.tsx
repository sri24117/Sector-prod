"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { AppShell, Field, Mark, Message, PageHead, Section, useGuard, type Me } from "../../lib/ui";

interface Alert { id: string; ruleId: string; metric: string; metricValue: string; threshold: string; message: string }

function AdGrants({ me }: { me: Me }) {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cid, setCid] = useState("");

  const guard = useGuard((m) => { setMsg(m); if (m) setOk(null); }, (e: ApiError) => {
    if (e.status === 403 && e.body?.error === "not_available") { setUnavailable(true); return true; }
    return false;
  });
  const load = useCallback(async () => setAlerts(await api<Alert[]>("/ad-grants/alerts")), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void guard(load); }, []);

  const act = (key: string, fn: () => Promise<void>) => guard(async () => { setBusy(key); try { await fn(); } finally { setBusy(null); } });

  if (unavailable) {
    return (
      <>
        <PageHead title="Ad Grants" />
        <div className="prose stack-3">
          <p>Google Ad Grants tools open once SEctOr has confirmed your organization&apos;s FCRA registration.</p>
          <p className="muted">Google only grants free ad budget to organizations that meet its nonprofit requirements, so this check comes first. SEctOr confirms it by checking your FCRA certificate.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead title="Ad Grants">SEctOr checks your Ad Grants account against the rules Google enforces and flags anything that needs attention. It reads your account only and never changes your campaigns.</PageHead>
      <Message text={msg} />
      <Message text={ok} tone="ok" />

      <Section title="Compliance" id="compliance">
        {alerts === null && <p className="muted" role="status">Loading…</p>}
        {alerts?.length === 0 && <p className="notice notice-ok"><Mark passed /><span>No open alerts.</span></p>}
        {alerts && alerts.length > 0 && (
          <ul className="findings">
            {alerts.map((a) => (
              <li key={a.id}>
                <Mark passed={false} />
                <div className="finding-body">
                  <p className="finding-title">{a.message}</p>
                  <p className="finding-status" data-tone="attention">Needs attention</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {me.role !== "viewer" && (
          <div className="actions">
            <button type="button" className="btn btn-quiet" disabled={busy === "run"} onClick={() => act("run", async () => {
              const r = await api<{ alerts: Alert[] }>("/ad-grants/compliance/run", { method: "POST" });
              setAlerts(r.alerts); setOk("Compliance check finished.");
            })}>{busy === "run" ? "Checking…" : "Check compliance now"}</button>
          </div>
        )}
      </Section>

      {me.role === "owner" && (
        <Section title="Link your Google Ads account" id="link">
          <form style={{ maxWidth: 480 }} onSubmit={(e) => { e.preventDefault(); void act("link", async () => {
            const r = await api<{ nextSteps: string[] }>("/ad-grants/account", { method: "POST", body: { googleCustomerId: cid } });
            setOk(r.nextSteps.join(" "));
          }); }}>
            <Field label="Google Ads customer ID" hint="Ten digits, shown at the top of your Google Ads account, for example 123-456-7890.">
              <input className="input" inputMode="numeric" value={cid} onChange={(e) => setCid(e.target.value)} required />
            </Field>
            <div className="actions"><button type="submit" className="btn" disabled={busy === "link"}>{busy === "link" ? "Linking…" : "Link account"}</button></div>
          </form>
        </Section>
      )}
    </>
  );
}

export default function AdGrantsPage() {
  return <AppShell>{(me) => <AdGrants me={me} />}</AppShell>;
}

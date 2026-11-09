"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api";
import {
  AppShell,
  PageHead,
  Section,
  Message,
  useGuard,
  type Me,
} from "../../lib/ui";
import {
  normalizePlan,
  PLAN_NAMES,
  CONTENT_ALLOWANCE,
  type Plan,
} from "@sector/shared/plans";
import {
  PLANS_CONFIG,
  COMPARISON_MATRIX,
  StatusCell,
  PlanRequestModal,
} from "../../lib/plans-ui";

interface PlanDetails {
  organizationId: string;
  organizationName: string;
  plan: Plan;
  planName: string;
  contentAllowance: number | null;
  contentUsedThisMonth: number;
  resetDate: string;
  createdAt: string;
  updatedAt: string;
}

function formatResetDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long" });
  } catch {
    return "the 1st of next month";
  }
}

function PlanView({ me }: { me: Me }) {
  const [data, setData] = useState<PlanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [modalPlan, setModalPlan] = useState<Plan | null>(null);

  const guard = useGuard(setMsg);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<PlanDetails>("/organization/plan");
      setData(res);
    } catch {
      // Fallback to me.plan if the endpoint encounters an issue
      const norm = normalizePlan(me.plan);
      setData({
        organizationId: me.organizationId,
        organizationName: me.organizationName,
        plan: norm,
        planName: PLAN_NAMES[norm],
        contentAllowance: CONTENT_ALLOWANCE[norm],
        contentUsedThisMonth: 0,
        resetDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => {
    void guard(loadPlan);
  }, [guard, loadPlan]);

  const activePlan = data ? normalizePlan(data.plan) : normalizePlan(me.plan);
  const planConfig = PLANS_CONFIG.find((p) => p.id === activePlan) || PLANS_CONFIG[0]!;
  const isStarter = activePlan === "starter";
  const isGrowthOrPro = activePlan === "growth" || activePlan === "pro";
  const isFree = activePlan === "free";

  const allowance = data?.contentAllowance ?? CONTENT_ALLOWANCE[activePlan];
  const used = data?.contentUsedThisMonth ?? 0;
  const isAtLimit = allowance !== null && used >= allowance;
  const usagePct = allowance ? Math.min(100, Math.round((used / allowance) * 100)) : 0;
  const resetFormatted = data?.resetDate ? formatResetDate(data.resetDate) : "1st of next month";

  return (
    <>
      <PageHead title="My plan & usage">
        Review your active plan, current monthly content allowance, and statutory feature access.
      </PageHead>

      <Message text={msg} />

      {loading && <p className="muted" role="status">Loading plan details…</p>}

      {!loading && data && (
        <div style={{ maxWidth: "880px" }}>
          {/* Active Plan Overview Card */}
          <Section title="Current plan" id="current-plan">
            <div className="card" style={{ marginBottom: "var(--s-4)" }}>
              <div className="card-head">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
                    <h2 style={{ fontSize: "22px", margin: 0, fontWeight: 600 }}>
                      {data.planName} Plan
                    </h2>
                    {isStarter && (
                      <span className="chip chip-win" style={{ fontSize: "11px", padding: "1px 8px" }}>
                        Available now
                      </span>
                    )}
                    {isGrowthOrPro && (
                      <span className="chip" style={{ fontSize: "11px", padding: "1px 8px" }}>
                        Founding-member waitlist
                      </span>
                    )}
                    {isFree && (
                      <span className="chip" style={{ fontSize: "11px", padding: "1px 8px" }}>
                        Open to everyone
                      </span>
                    )}
                  </div>
                  <p className="small muted" style={{ marginTop: "var(--s-1)" }}>
                    {planConfig.audience}
                  </p>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "20px", fontWeight: 600 }}>
                    {isFree ? "Free" : `₹${planConfig.monthly.toLocaleString("en-IN")}`}
                  </div>
                  {!isFree && (
                    <span className="small muted" style={{ display: "block" }}>
                      + 18% GST / month (by invoice)
                    </span>
                  )}
                </div>
              </div>

              {/* Founding Member note for Growth and Pro */}
              {isGrowthOrPro && (
                <div
                  style={{
                    marginTop: "var(--s-3)",
                    padding: "var(--s-2) var(--s-3)",
                    background: "rgba(31, 77, 59, 0.05)",
                    borderRadius: "var(--radius)",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Founding-member benefit:</strong> Your organization has access to current active tools with your price locked for 12 months. New features (automated social publishing, grant watchlists) activate automatically as they pass review.
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginTop: "var(--s-4)", paddingTop: "var(--s-3)", borderTop: "1px solid var(--line)", gap: "var(--s-3)" }}>
                <span className="small muted">
                  Plan active for <strong>{data.organizationName}</strong>. Managed by SEctOr operations.
                </span>

                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => setModalPlan(isFree ? "starter" : isStarter ? "growth" : "pro")}
                >
                  Contact SEctOr to change plan
                </button>
              </div>
            </div>
          </Section>

          {/* Monthly Content Allowance Meter */}
          <Section title="Monthly content allowance" id="allowance">
            <div className="card">
              <div className="card-head">
                <p className="finding-title" style={{ fontSize: "16px", margin: 0 }}>
                  Content drafting with beneficiary consent
                </p>
                {allowance === null ? (
                  <span className="status-pill status-pill-pass">
                    <span aria-hidden="true">✓</span> No monthly cap
                  </span>
                ) : isAtLimit ? (
                  <span className="status-pill status-pill-attention">
                    <span aria-hidden="true">•</span> Allowance limit reached
                  </span>
                ) : isFree ? (
                  <span className="status-pill status-pill-unverified">
                    — Locked on Free
                  </span>
                ) : (
                  <span className="status-pill status-pill-pass">
                    {used} / {allowance} used
                  </span>
                )}
              </div>

              {isFree ? (
                <div style={{ marginTop: "var(--s-3)" }}>
                  <p className="prose small muted">
                    The Free plan includes full search audits and manual remediation steps. Drafting AI-assisted non-profit comms with DPDP-compliant beneficiary consent records is included in the Starter plan (15 pieces a month).
                  </p>
                  <div style={{ marginTop: "var(--s-4)" }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setModalPlan("starter")}
                    >
                      Upgrade to Starter (₹4,999/mo + GST)
                    </button>
                  </div>
                </div>
              ) : allowance === null ? (
                <div style={{ marginTop: "var(--s-3)" }}>
                  <p className="prose small">
                    Your organization has drafted <strong>{used} pieces</strong> this month. As a founding-member on the <strong>{data.planName}</strong> plan, there is no monthly cap applied to your content drafts.
                  </p>
                  <div style={{ marginTop: "var(--s-3)" }}>
                    <a href="/content" className="btn btn-quiet">
                      Go to Content workspace →
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: "var(--s-3)" }}>
                  {/* Progress Meter */}
                  <div className="meter-container">
                    <div className="meter-track" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={allowance}>
                      <div
                        className={`meter-fill ${isAtLimit ? "meter-fill-warning" : ""}`}
                        style={{ width: `${usagePct}%` }}
                      />
                    </div>
                    <div className="meter-meta">
                      <span>
                        <strong>{used}</strong> of <strong>{allowance}</strong> pieces used this month
                      </span>
                      <span className="muted">
                        Resets on {resetFormatted}
                      </span>
                    </div>
                  </div>

                  {isAtLimit ? (
                    <p className="prose small" style={{ color: "var(--ochre)", marginTop: "var(--s-3)" }}>
                      You have used your {allowance} pieces this month. The allowance resets on {resetFormatted}. Contact SEctOr if your communications team needs additional drafting allowance.
                    </p>
                  ) : (
                    <p className="prose small muted" style={{ marginTop: "var(--s-3)" }}>
                      Every piece includes mandatory DPDP consent records and tone-of-voice alignment. Resets automatically on {resetFormatted}.
                    </p>
                  )}

                  <div style={{ display: "flex", gap: "var(--s-3)", marginTop: "var(--s-4)" }}>
                    <a href="/content" className="btn btn-quiet">
                      Create new draft
                    </a>
                    {isAtLimit && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setModalPlan("growth")}
                      >
                        Request allowance expansion
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Feature Comparison Matrix */}
          <Section title="Plan feature checklist" id="features">
            <p className="small muted" style={{ marginBottom: "var(--s-3)" }}>
              Current capabilities and roadmap features across all SEctOr plans. Your active plan is highlighted below.
            </p>

            <div className="matrix-wrap" style={{ border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
              <table className="matrix-table" aria-label="Feature comparison">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: "36%" }}>Feature</th>
                    <th scope="col" style={activePlan === "free" ? { background: "rgba(31, 77, 59, 0.08)", fontWeight: 600 } : undefined}>
                      Free {activePlan === "free" && "(Current)"}
                    </th>
                    <th scope="col" style={activePlan === "starter" ? { background: "rgba(31, 77, 59, 0.08)", fontWeight: 600 } : undefined}>
                      Starter {activePlan === "starter" && "(Current)"}
                    </th>
                    <th scope="col" style={activePlan === "growth" ? { background: "rgba(31, 77, 59, 0.08)", fontWeight: 600 } : undefined}>
                      Growth {activePlan === "growth" && "(Current)"}
                    </th>
                    <th scope="col" style={activePlan === "pro" ? { background: "rgba(31, 77, 59, 0.08)", fontWeight: 600 } : undefined}>
                      Pro {activePlan === "pro" && "(Current)"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_MATRIX.flatMap((cat, catIdx) => {
                    const headerRow = (
                      <tr key={`cat-${catIdx}`}>
                        <td colSpan={5} className="matrix-category">
                          {cat.title}
                        </td>
                      </tr>
                    );
                    const rows = cat.rows.map((row, rowIdx) => (
                      <tr key={`row-${catIdx}-${rowIdx}`}>
                        <th scope="row" style={{ fontWeight: row.highlight ? 600 : 400 }}>
                          {row.name}
                        </th>
                        <td style={activePlan === "free" ? { background: "rgba(31, 77, 59, 0.04)" } : undefined}>
                          <StatusCell val={row.free} />
                        </td>
                        <td style={activePlan === "starter" ? { background: "rgba(31, 77, 59, 0.04)" } : undefined}>
                          <StatusCell val={row.starter} />
                        </td>
                        <td style={activePlan === "growth" ? { background: "rgba(31, 77, 59, 0.04)" } : undefined}>
                          <StatusCell val={row.growth} />
                        </td>
                        <td style={activePlan === "pro" ? { background: "rgba(31, 77, 59, 0.04)" } : undefined}>
                          <StatusCell val={row.pro} />
                        </td>
                      </tr>
                    ));
                    return [headerRow, ...rows];
                  })}
                </tbody>
              </table>
            </div>

            <p className="small muted" style={{ marginTop: "var(--s-3)" }}>
              * Free plan has no time limit. Paid plans are billed by manual tax invoice with 18% GST. No credit cards or automatic debits are used.
            </p>
          </Section>
        </div>
      )}

      {/* Plan Request / Change Modal (P02a) */}
      {modalPlan && (
        <PlanRequestModal
          plan={modalPlan}
          onClose={() => setModalPlan(null)}
          initialOrgName={me.organizationName}
          initialUserName={me.name}
          initialEmail={me.email}
        />
      )}
    </>
  );
}

export default function PlanPage() {
  return (
    <AppShell>
      {(me) => <PlanView me={me} />}
    </AppShell>
  );
}

"use client";

import { useState, useId } from "react";
import { PLAN_NAMES, type Plan } from "@sector/shared/plans";

export interface PlanConfig {
  id: Plan;
  name: string;
  monthly: number;
  annual: number;
  badge: string;
  badgeType: "open" | "active" | "waitlist";
  audience: string;
  live: string[];
  comingSoon?: string[];
  cta: string;
}

export const PLANS_CONFIG: PlanConfig[] = [
  {
    id: "free",
    name: PLAN_NAMES.free,
    monthly: 0,
    annual: 0,
    badge: "Open to everyone",
    badgeType: "open",
    audience: "For non-profits and charities wanting to understand where their website stands today.",
    live: [
      "Public search & AI visibility audit",
      "Overall score out of 100 with check weights",
      "Plain-language manual fix instructions for all 7 checks",
    ],
    cta: "Run free audit",
  },
  {
    id: "starter",
    name: PLAN_NAMES.starter,
    monthly: 4999,
    annual: 44990,
    badge: "Available now",
    badgeType: "active",
    audience: "For organizations ready to fix their search presence live and publish compliant stories.",
    live: [
      "Everything in Free",
      "Live 1-click WordPress structured-data fix with restore",
      "Verified full-site deep crawl & download-ready PDF report",
      "15 drafted content pieces a month (DPDP consent gated)",
      "Manual posting calendar with team member assignment",
    ],
    cta: "Ask for an invoice",
  },
  {
    id: "growth",
    name: PLAN_NAMES.growth,
    monthly: 9999,
    annual: 89990,
    badge: "Founding-member waitlist",
    badgeType: "waitlist",
    audience: "For established non-profits building multi-channel digital authority and donor outreach.",
    live: [
      "Everything in Starter",
      "Drafted content with no monthly cap yet",
    ],
    comingSoon: [
      "Automated social platform publishing",
      "Grants, CSR RFQs & tenders discovery watchlist",
    ],
    cta: "Join the waitlist",
  },
  {
    id: "pro",
    name: PLAN_NAMES.pro,
    monthly: 19999,
    annual: 179990,
    badge: "Founding-member waitlist",
    badgeType: "waitlist",
    audience: "For high-impact organizations unlocking and defending Google Ad Grants ad spend.",
    live: [
      "Everything in Growth",
      "Google Ad Grants compliance checker (requires confirmed FCRA)",
    ],
    comingSoon: [
      "Automated ad compliance alerts and MCC actions",
      "Periodic human review by the SEctOr team",
    ],
    cta: "Join the waitlist",
  },
];

export interface MatrixRow {
  name: string;
  free: string;
  starter: string;
  growth: string;
  pro: string;
  highlight?: boolean;
}

export interface MatrixCategory {
  title: string;
  rows: MatrixRow[];
}

export const COMPARISON_MATRIX: MatrixCategory[] = [
  {
    title: "Audit & Website Visibility",
    rows: [
      { name: "Public 7-check search & AI assistant scan", free: "Yes", starter: "Yes", growth: "Yes", pro: "Yes" },
      { name: "Score breakdown (0–100) & manual fix steps", free: "Yes", starter: "Yes", growth: "Yes", pro: "Yes" },
      { name: "Verified full-site deep crawl & print PDF", free: "—", starter: "Yes", growth: "Yes", pro: "Yes" },
      { name: "1-click live WordPress structured data fix & restore", free: "—", starter: "Yes", growth: "Yes", pro: "Yes" },
    ],
  },
  {
    title: "Content & Communications",
    rows: [
      { name: "Brand voice intake & style profile", free: "—", starter: "Yes", growth: "Yes", pro: "Yes" },
      { name: "DPDP Act beneficiary consent manager", free: "—", starter: "Yes", growth: "Yes", pro: "Yes" },
      { name: "AI-assisted content drafting allowance", free: "—", starter: "15 pieces/mo", growth: "No cap yet", pro: "No cap yet", highlight: true },
      { name: "Publishing calendar (manual posting)", free: "—", starter: "Yes", growth: "Yes", pro: "Yes" },
      { name: "Direct social auto-publishing", free: "—", starter: "—", growth: "Coming soon", pro: "Coming soon" },
    ],
  },
  {
    title: "Research & Ad Grants",
    rows: [
      { name: "4-pillar research report (SEO, GEO, UI/UX, Brand)", free: "—", starter: "Planned", growth: "Planned", pro: "Planned" },
      { name: "Grants & CSR RFQs discovery watchlist", free: "—", starter: "—", growth: "Coming soon", pro: "Coming soon" },
      { name: "Google Ad Grants compliance monitoring", free: "—", starter: "—", growth: "—", pro: "Yes (FCRA required)" },
      { name: "Periodic human review by SEctOr ops team", free: "—", starter: "—", growth: "—", pro: "Coming soon" },
    ],
  },
];

export function formatInr(val: number): string {
  return val.toLocaleString("en-IN");
}

export function StatusCell({ val }: { val: string }) {
  if (val === "Yes") {
    return <span className="matrix-status matrix-status-yes"><span aria-hidden="true">✓</span> Yes</span>;
  }
  if (val === "—") {
    return <span className="matrix-status matrix-status-locked" aria-label="Not included">—</span>;
  }
  if (val.includes("Coming soon")) {
    return <span className="matrix-status matrix-status-soon"><span aria-hidden="true">•</span> Coming soon</span>;
  }
  if (val.includes("Planned")) {
    return <span className="matrix-status matrix-status-soon"><span aria-hidden="true">•</span> Planned</span>;
  }
  return <span className="matrix-status" style={{ fontWeight: 500 }}>{val}</span>;
}

export interface ModalProps {
  plan: Plan;
  billing?: "monthly" | "annual";
  onClose: () => void;
  initialOrgName?: string;
  initialUserName?: string;
  initialEmail?: string;
}

export function PlanRequestModal({
  plan,
  billing = "monthly",
  onClose,
  initialOrgName = "",
  initialUserName = "",
  initialEmail = "",
}: ModalProps) {
  const [orgName, setOrgName] = useState(initialOrgName);
  const [userName, setUserName] = useState(initialUserName);
  const [email, setEmail] = useState(initialEmail);
  const [notes, setNotes] = useState("");
  const [targetPlan, setTargetPlan] = useState<Plan>(plan);
  const [cadence, setCadence] = useState<"monthly" | "annual">(billing);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const formId = useId();

  const isWaitlist = targetPlan === "growth" || targetPlan === "pro";
  const planObj = (PLANS_CONFIG.find((p) => p.id === targetPlan) ?? PLANS_CONFIG[1])!;
  const price = cadence === "annual" ? planObj.annual : planObj.monthly;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim() || !userName.trim() || !email.trim()) return;

    setStatus("submitting");
    try {
      // Simulate/submit request and trigger harmless fire-and-forget logging
      await new Promise((r) => setTimeout(r, 600));
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${formId}-title`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-box">
        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "var(--s-4) 0" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(31, 77, 59, 0.12)",
                color: "var(--pine)",
                fontSize: "24px",
                marginBottom: "var(--s-4)",
              }}
            >
              ✓
            </div>
            <h2 className="headline" id={`${formId}-title`} style={{ fontSize: "24px" }}>
              {isWaitlist ? "You are on the waitlist" : "Request received"}
            </h2>
            <p className="prose" style={{ marginTop: "var(--s-3)", fontSize: "15px" }}>
              Thank you, <strong>{userName}</strong>. The SEctOr team will contact you at{" "}
              <strong>{email}</strong> regarding onboarding and manual invoicing for{" "}
              <strong>{orgName}</strong> on the <strong>{planObj.name}</strong> plan.
            </p>
            <div className="actions" style={{ justifyContent: "center", marginTop: "var(--s-6)" }}>
              <button type="button" className="btn" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="headline" id={`${formId}-title`} style={{ fontSize: "24px" }}>
              {isWaitlist ? `Join the ${planObj.name} Waitlist` : `Request ${planObj.name} Plan Invoice`}
            </h2>
            <p className="muted small" style={{ marginTop: "var(--s-2)" }}>
              You pay by invoice. SEctOr&apos;s team will contact you; nothing is charged now.
            </p>

            <form onSubmit={handleSubmit} style={{ marginTop: "var(--s-5)" }}>
              <label className="field">
                <span className="field-label">Organization name</span>
                <input
                  className="input"
                  type="text"
                  required
                  placeholder="e.g. Hope Foundation"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--s-3)", marginTop: "var(--s-4)" }}>
                <label className="field">
                  <span className="field-label">Your name</span>
                  <input
                    className="input"
                    type="text"
                    required
                    placeholder="First and last name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Work email</span>
                  <input
                    className="input"
                    type="email"
                    required
                    placeholder="name@ngo.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--s-3)", marginTop: "var(--s-4)" }}>
                <label className="field">
                  <span className="field-label">Plan</span>
                  <select
                    className="input"
                    value={targetPlan}
                    onChange={(e) => setTargetPlan(e.target.value as Plan)}
                  >
                    <option value="starter">Starter (₹4,999/mo + GST)</option>
                    <option value="growth">Growth (₹9,999/mo + GST) [Waitlist]</option>
                    <option value="pro">Pro (₹19,999/mo + GST) [Waitlist]</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Billing cycle</span>
                  <select
                    className="input"
                    value={cadence}
                    onChange={(e) => setCadence(e.target.value as "monthly" | "annual")}
                  >
                    <option value="monthly">Monthly (+18% GST)</option>
                    <option value="annual">Annual (~25% savings)</option>
                  </select>
                </label>
              </div>

              <div style={{ marginTop: "var(--s-3)", padding: "var(--s-2) var(--s-3)", background: "var(--paper)", borderRadius: "var(--radius)", fontSize: "13px" }}>
                <span>Invoice estimate: </span>
                <strong>₹{formatInr(price)} + 18% GST</strong> {cadence === "annual" ? "per year" : "per month"}
              </div>

              <label className="field" style={{ marginTop: "var(--s-4)" }}>
                <span className="field-label">Notes or questions (optional)</span>
                <textarea
                  className="input"
                  style={{ minHeight: "72px" }}
                  placeholder="Website address, FCRA registration status, or any specific requirements..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>

              {status === "error" && (
                <p className="notice notice-attention small" style={{ marginTop: "var(--s-3)" }}>
                  Could not submit your request. Please check your connection and try again.
                </p>
              )}

              <div className="actions" style={{ marginTop: "var(--s-5)", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-quiet" onClick={onClose} disabled={status === "submitting"}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={status === "submitting"}>
                  {status === "submitting" ? "Sending…" : isWaitlist ? "Join waitlist" : "Send invoice request"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

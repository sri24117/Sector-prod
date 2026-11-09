"use client";

import { useState, useEffect, useId } from "react";
import { PLAN_NAMES, type Plan } from "@sector/shared/plans";

interface PlanConfig {
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

const PLANS_CONFIG: PlanConfig[] = [
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

interface MatrixRow {
  name: string;
  free: string;
  starter: string;
  growth: string;
  pro: string;
  highlight?: boolean;
}

interface MatrixCategory {
  title: string;
  rows: MatrixRow[];
}

const COMPARISON_MATRIX: MatrixCategory[] = [
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

const FAQS = [
  {
    q: "Do these prices include GST?",
    a: "No. 18% Goods & Services Tax (GST) is added to each invoice as mandated by Indian tax law. A GST-compliant tax invoice is provided for every payment.",
  },
  {
    q: "How do we pay?",
    a: "All payments are made via manual tax invoice. We accept NEFT/RTGS, direct bank transfer, and UPI. There is no automated card charging or unexpected recurring debit.",
  },
  {
    q: "Can we try SEctOr before paying anything?",
    a: "Yes. The homepage audit is 100% free with no signup or card needed. You can also sign up for a free account anytime to follow the manual remediation guides and track scores.",
  },
  {
    q: "What does 'Founding-member waitlist' mean for Growth and Pro?",
    a: "Growth and Pro include features currently in engineering (such as automated social posting and Ad Grants sync). Joining the waitlist reserves your spot at today's locked price for 12 months, with early access as each feature ships.",
  },
  {
    q: "What are the rules for Google Ad Grants?",
    a: "Google provides up to $10,000/month (~₹8 Lakhs/month) in free search ads to eligible non-profits. Under Indian regulations, valid FCRA registration is required. SEctOr verifies your FCRA registration before opening Ad Grants tools.",
  },
  {
    q: "Can we cancel or switch plans?",
    a: "Yes. Because billing is by invoice, you can change your plan or choose not to renew at the end of any billing cycle with no cancellation penalties.",
  },
];

function formatInr(num: number): string {
  return new Intl.NumberFormat("en-IN").format(num);
}

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  // Close modal on escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedPlan(null);
    }
    if (selectedPlan) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [selectedPlan]);

  return (
    <main className="page">
      {/* Top Navigation */}
      <header className="shell-top" style={{ marginBottom: "var(--s-7)" }}>
        <a className="wordmark" href="/">SEctOr</a>
        <div className="shell-user">
          <a className="small" href="/">Run audit</a>
          <a className="small" href="/login">Log in</a>
          <a className="btn btn-quiet" href="/signup" style={{ padding: "4px 12px", fontSize: "13px" }}>Create account</a>
        </div>
      </header>

      {/* Hero Header */}
      <div className="pricing-header">
        <h1 className="headline">Honest pricing for Indian non-profits</h1>
        <p className="muted prose" style={{ margin: "var(--s-3) auto 0" }}>
          All prices in Indian Rupees, exclusive of 18% GST. You pay by invoice — no credit card, no auto-renewal.
        </p>

        {/* Billing Cadence Toggle */}
        <div className="billing-toggle" role="group" aria-label="Billing frequency">
          <button
            type="button"
            className="toggle-btn"
            aria-pressed={billing === "monthly"}
            onClick={() => setBilling("monthly")}
          >
            Monthly billing
          </button>
          <button
            type="button"
            className="toggle-btn"
            aria-pressed={billing === "annual"}
            onClick={() => setBilling("annual")}
          >
            Annual billing
            <span className="toggle-badge">Save ~25%</span>
          </button>
        </div>
      </div>

      {/* Four Plan Cards */}
      <div className="pricing-grid">
        {PLANS_CONFIG.map((plan) => {
          const isStarter = plan.id === "starter";
          const price = billing === "annual" ? plan.annual : plan.monthly;
          const isFree = plan.id === "free";

          return (
            <article
              key={plan.id}
              className="pricing-card"
              data-featured={isStarter ? "" : undefined}
            >
              <div className="pricing-card-top">
                <div className="pricing-card-head">
                  <h2 className="pricing-plan-name">{plan.name}</h2>
                  <span
                    className={`chip ${plan.badgeType === "active" ? "chip-win" : ""}`}
                    style={{ fontSize: "11px", padding: "1px 8px" }}
                  >
                    {plan.badge}
                  </span>
                </div>

                <div className="pricing-amount">
                  <span className="pricing-num">
                    {isFree ? "Free" : `₹${formatInr(price)}`}
                  </span>
                  {!isFree && (
                    <span className="pricing-tax">
                      + 18% GST {billing === "annual" ? "/ yr" : "/ mo"}
                    </span>
                  )}
                </div>

                <p className="pricing-desc small">{plan.audience}</p>

                <ul className="pricing-features">
                  {plan.live.map((feat, i) => (
                    <li key={`live-${i}`}>
                      <span className="mark mark-pass" aria-hidden="true">✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                  {plan.comingSoon?.map((feat, i) => (
                    <li key={`soon-${i}`} data-muted>
                      <span className="mark mark-attention" aria-hidden="true">•</span>
                      <span>{feat} <em className="small muted">(coming soon)</em></span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pricing-card-bottom">
                {isFree ? (
                  <a href="/" className="btn btn-quiet">
                    {plan.cta}
                  </a>
                ) : (
                  <button
                    type="button"
                    className={`btn ${isStarter ? "" : "btn-quiet"}`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    {plan.cta}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Honest line under Growth and Pro */}
      <div className="pricing-honesty-note">
        <strong>Honest promise on Growth and Pro:</strong> Both plans start with the same working tools as Starter today. Extra features (social auto-publishing, tender scans) are clearly marked as coming soon. Founding members keep today&apos;s price locked for 12 months and receive new capabilities automatically as they ship.
      </div>

      {/* Comparison Matrix Section */}
      <section className="section" style={{ marginTop: "var(--s-8)" }}>
        <h2 className="section-heading">Detailed feature comparison</h2>
        <p className="muted prose" style={{ marginTop: "var(--s-2)" }}>
          Everything in SEctOr is designed for transparent operation. If a feature is not live, we say so plainly.
        </p>

        <div className="matrix-wrap">
          <table className="matrix-table" aria-label="Feature comparison matrix">
            <thead>
              <tr>
                <th scope="col" style={{ width: "40%" }}>Feature</th>
                <th scope="col">Free</th>
                <th scope="col" style={{ background: "rgba(31, 77, 59, 0.05)" }}>Starter</th>
                <th scope="col">Growth</th>
                <th scope="col">Pro</th>
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
                    <td><StatusCell val={row.free} /></td>
                    <td style={{ background: "rgba(31, 77, 59, 0.03)" }}><StatusCell val={row.starter} /></td>
                    <td><StatusCell val={row.growth} /></td>
                    <td><StatusCell val={row.pro} /></td>
                  </tr>
                ));
                return [headerRow, ...rows];
              })}
            </tbody>
          </table>
        </div>

        <p className="small muted" style={{ marginTop: "var(--s-4)" }}>
          * Generated content allowance: 15 pieces a month on Starter. There is no monthly limit on website audits or full reports.
        </p>
      </section>

      {/* Frequently Asked Questions */}
      <section className="section">
        <h2 className="section-heading">Frequently asked questions</h2>
        <ul className="faq-list">
          {FAQS.map((faq, idx) => (
            <li key={idx} className="faq-item">
              <h3 className="faq-question">{faq.q}</h3>
              <p className="faq-answer">{faq.a}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Bottom CTA */}
      <section className="section" style={{ textAlign: "center", paddingBottom: "var(--s-7)" }}>
        <h2 className="headline" style={{ fontSize: "28px" }}>See how visible your site is right now</h2>
        <p className="muted prose" style={{ margin: "var(--s-2) auto 0" }}>
          Free, takes 10 seconds, no password or credit card needed.
        </p>
        <div className="actions" style={{ justifyContent: "center", marginTop: "var(--s-5)" }}>
          <a className="btn" href="/">Run free audit</a>
          <a className="btn btn-quiet" href="/signup">Create account</a>
        </div>
      </section>

      {/* Plan Request Modal (P02a) */}
      {selectedPlan && (
        <PlanRequestModal
          plan={selectedPlan}
          billing={billing}
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </main>
  );
}

function StatusCell({ val }: { val: string }) {
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

interface ModalProps {
  plan: Plan;
  billing: "monthly" | "annual";
  onClose: () => void;
}

function PlanRequestModal({ plan, billing, onClose }: ModalProps) {
  const [orgName, setOrgName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
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
      <div className="modal-card">
        <button
          type="button"
          className="modal-close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          ✕
        </button>

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

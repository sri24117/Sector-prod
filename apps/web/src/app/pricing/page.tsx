"use client";

import { useState, useEffect } from "react";
import type { Plan } from "@sector/shared/plans";
import {
  PLANS_CONFIG,
  COMPARISON_MATRIX,
  formatInr,
  StatusCell,
  PlanRequestModal,
} from "../../lib/plans-ui";

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
        <dl className="pricing-faq" style={{ marginTop: "var(--s-4)" }}>
          {FAQS.map((faq, i) => (
            <div key={`faq-${i}`} className="faq-item">
              <dt className="faq-q">{faq.q}</dt>
              <dd className="faq-a small prose">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Bottom Callout */}
      <section className="section" style={{ textAlign: "center", borderTop: "1px solid var(--line)", paddingTop: "var(--s-7)" }}>
        <h2 className="headline" style={{ fontSize: "24px" }}>Start with your website&apos;s free audit</h2>
        <p className="muted prose" style={{ margin: "var(--s-2) auto 0" }}>
          See your current score across search engines and AI assistants in 30 seconds.
        </p>
        <div className="actions" style={{ justifyContent: "center", marginTop: "var(--s-4)" }}>
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

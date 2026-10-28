// The one plan/tier table, used by the API (enforcement) and the web app (locked states).
// Product scope and pricing: docs/product/product.md "Pricing and plans". No imports on purpose,
// so the web app can load this file directly (`@sector/shared/plans`).

export const PLANS = ["free", "starter", "growth", "pro"] as const;
export type Plan = (typeof PLANS)[number];

// organizations.plan is plain text. These older names keep working as Starter, so existing
// organizations need no data change.
export const LEGACY_PLAN_ALIASES: Readonly<Record<string, Plan>> = { pilot: "starter", paid: "starter" };

/** Any stored plan value to a current plan. Unknown or missing values get no paid access. */
export function normalizePlan(raw: string | null | undefined): Plan {
  if (raw && (PLANS as readonly string[]).includes(raw)) return raw as Plan;
  return (raw && LEGACY_PLAN_ALIASES[raw]) || "free";
}

export const PLAN_NAMES: Readonly<Record<Plan, string>> = { free: "Free", starter: "Starter", growth: "Growth", pro: "Pro" };

export type Feature = "full_report" | "wordpress_fix" | "content" | "ad_grants";

// The lowest plan that includes each feature. Higher plans include everything below them.
export const FEATURES: Readonly<Record<Feature, { label: string; minPlan: Plan }>> = {
  full_report: { label: "The full report", minPlan: "starter" },
  wordpress_fix: { label: "Live WordPress fixes", minPlan: "starter" },
  content: { label: "Brand kit, consent records and content drafting", minPlan: "starter" },
  ad_grants: { label: "Ad Grants monitoring", minPlan: "pro" },
};

// Generated pieces of content a month; null = no cap.
// TODO(founder): the Growth and Pro allowances are undecided until real AI cost is known. Do not guess.
export const CONTENT_ALLOWANCE: Readonly<Record<Plan, number | null>> = { free: 0, starter: 15, growth: null, pro: null };

export function planRank(plan: Plan): number { return PLANS.indexOf(plan); }

export function hasFeature(rawPlan: string | null | undefined, feature: Feature): boolean {
  return planRank(normalizePlan(rawPlan)) >= planRank(FEATURES[feature].minPlan);
}

/** Plain-language refusal naming the plan that is needed. */
export function planRequiredMessage(feature: Feature): string {
  const { label, minPlan } = FEATURES[feature];
  const next = minPlan === "starter" ? "Contact SEctOr to upgrade." : "Growth and Pro are a founding-member waitlist: contact SEctOr to join.";
  return `${label} is part of the ${PLAN_NAMES[minPlan]} plan. ${next}`;
}

/** Start of the current calendar month in Asia/Kolkata (fixed UTC+5:30, no daylight saving), as a UTC instant. */
export function monthStartIst(now: Date = new Date()): Date {
  const offset = 330 * 60_000;
  const ist = new Date(now.getTime() + offset);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - offset);
}

/** What ops may pass to `set-plan`: the current plans plus the legacy names. */
export const SETTABLE_PLANS: readonly string[] = [...PLANS, ...Object.keys(LEGACY_PLAN_ALIASES)];

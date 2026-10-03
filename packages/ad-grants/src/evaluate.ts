import type { ComplianceFinding, ComplianceSnapshot } from "./types.js";

// Deterministic rules from skills/ad-grants.md §4. NO LLM here (CLAUDE.md §2).
// Deliberately ABSENT (per the skill's corrections):
//  - the "90-day inactivity" rule (does not exist as commonly stated)
//  - any high-CPC flag on Smart Bidding accounts (false positive; $2 cap only applies to Manual CPC / Maximize Clicks)
//  - "Limited Ad Serving" (unconfirmed third-party report; do not ship a rule on it)
const SMART_BIDDING = new Set(["MAXIMIZE_CONVERSIONS", "MAXIMIZE_CONVERSION_VALUE", "TARGET_CPA", "TARGET_ROAS"]);
const CPC_CAPPED = new Set(["MANUAL_CPC", "MAXIMIZE_CLICKS"]);
const VANITY_CONVERSION_CATEGORIES = new Set(["PAGE_VIEW", "ENGAGEMENT"]); // e.g. time-on-site does not count
const MODERN_ACCOUNT_CUTOFF = Date.parse("2019-04-22");
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function evaluateCompliance(s: ComplianceSnapshot): ComplianceFinding[] {
  const out: ComplianceFinding[] = [];
  const modern = Date.parse(s.accountCreatedAt) > MODERN_ACCOUNT_CUTOFF;

  // 1. 5% account-level CTR; two consecutive months below triggers temporary deactivation.
  if (s.ctrLast30d < 0.05) {
    const second = s.ctrPrev30d < 0.05;
    out.push({
      ruleId: "ctr_5pct", metric: "account_ctr_last_30d", metricValue: pct(s.ctrLast30d), threshold: "5.0%",
      message: second
        ? `Account CTR is ${pct(s.ctrLast30d)} (previous 30 days: ${pct(s.ctrPrev30d)}), below the 5% minimum for two consecutive months — temporary deactivation risk.`
        : `Account CTR is ${pct(s.ctrLast30d)}, below the 5% minimum. A second consecutive month below 5% triggers temporary deactivation.`,
    });
  }

  // 2. Keywords at Quality Score 1-2 must be paused/removed.
  const lowQs = s.keywords.filter((k) => k.qualityScore !== null && k.qualityScore <= 2);
  if (lowQs.length) {
    out.push({
      ruleId: "quality_score_1_2", metric: "keywords_with_quality_score_1_2", metricValue: String(lowQs.length), threshold: "0",
      message: `${lowQs.length} keyword(s) have Quality Score 1-2 and must be paused or removed: ${lowQs.slice(0, 5).map((k) => `"${k.text}"`).join(", ")}${lowQs.length > 5 ? ", …" : ""}.`,
    });
  }

  if (modern) {
    // 3. Conversion tracking: >=1 meaningful conversion action and >=1 qualifying conversion/month.
    const qualifying = s.conversionActions.filter((c) => !VANITY_CONVERSION_CATEGORIES.has(c.category.toUpperCase()));
    const conv = qualifying.reduce((n, c) => n + c.conversionsLast30d, 0);
    if (qualifying.length === 0) {
      out.push({ ruleId: "conversion_tracking", metric: "meaningful_conversion_actions", metricValue: "0", threshold: "1", message: "No meaningful conversion action is configured (page views and time-on-site do not count)." });
    } else if (conv < 1) {
      out.push({ ruleId: "conversion_tracking", metric: "qualifying_conversions_last_30d", metricValue: String(conv), threshold: "1", message: `Only ${conv} qualifying conversions in the last 30 days; at least 1 per month is required.` });
    }

    // 4. Smart Bidding is mandatory for modern accounts.
    const manual = s.campaigns.filter((c) => !SMART_BIDDING.has(c.biddingStrategy));
    if (manual.length) {
      out.push({
        ruleId: "smart_bidding", metric: "campaigns_without_smart_bidding", metricValue: String(manual.length), threshold: "0",
        message: `${manual.length} campaign(s) do not use Smart Bidding (${[...new Set(manual.map((c) => c.biddingStrategy))].join(", ")}): ${manual.map((c) => `"${c.name}"`).join(", ")}.`,
      });
    }
  }

  // 5. Minimum account structure.
  const thin = s.campaigns.filter((c) => c.adGroupCount < 2);
  if (thin.length) out.push({ ruleId: "min_ad_groups", metric: "campaigns_with_fewer_than_2_ad_groups", metricValue: String(thin.length), threshold: "0", message: `${thin.length} campaign(s) have fewer than 2 ad groups: ${thin.map((c) => `"${c.name}"`).join(", ")}.` });
  if (s.uniqueSitelinkCount < 2) out.push({ ruleId: "min_sitelinks", metric: "unique_sitelinks", metricValue: String(s.uniqueSitelinkCount), threshold: "2", message: `Only ${s.uniqueSitelinkCount} unique sitelink(s); at least 2 are required.` });
  const single = s.keywords.filter((k) => k.text.trim().split(/\s+/).length === 1);
  if (single.length) out.push({ ruleId: "single_word_keywords", metric: "single_word_keywords", metricValue: String(single.length), threshold: "0", message: `${single.length} single-word keyword(s) are not allowed: ${single.slice(0, 5).map((k) => `"${k.text}"`).join(", ")}${single.length > 5 ? ", …" : ""}.` });

  // 6. $2 CPC cap — ONLY where it applies (Manual CPC / Maximize Clicks).
  const strategyByCampaign = new Map(s.campaigns.map((c) => [c.name, c.biddingStrategy]));
  const overCap = s.keywords.filter((k) => k.maxCpcUsd !== null && k.maxCpcUsd > 2 && CPC_CAPPED.has(strategyByCampaign.get(k.campaign) ?? ""));
  if (overCap.length) out.push({ ruleId: "cpc_cap_2usd", metric: "keywords_over_2usd_cpc_on_capped_strategies", metricValue: String(overCap.length), threshold: "$2.00", message: `${overCap.length} keyword(s) on Manual CPC/Maximize Clicks campaigns exceed the $2.00 CPC cap.` });

  return out;
}

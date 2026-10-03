import { describe, it, expect } from "vitest";
import { evaluateCompliance, type ComplianceSnapshot } from "../src/index.js";

const good = (): ComplianceSnapshot => ({
  accountCreatedAt: "2023-01-01", ctrLast30d: 0.08, ctrPrev30d: 0.07,
  conversionActions: [{ name: "Donation", category: "PURCHASE", conversionsLast30d: 12 }],
  campaigns: [{ name: "Main", biddingStrategy: "MAXIMIZE_CONVERSIONS", adGroupCount: 3 }],
  keywords: [{ text: "donate to children charity", campaign: "Main", qualityScore: 7, maxCpcUsd: 6.5 }],
  uniqueSitelinkCount: 4,
});
const ids = (s: ComplianceSnapshot) => evaluateCompliance(s).map((f) => f.ruleId);

describe("Ad Grants compliance rules", () => {
  it("a compliant account produces zero alerts", () => expect(evaluateCompliance(good())).toEqual([]));

  it("CTR below 5% alerts and CITES the rule + the metric value that triggered it", () => {
    const [f] = evaluateCompliance({ ...good(), ctrLast30d: 0.032, ctrPrev30d: 0.09 });
    expect(f).toMatchObject({ ruleId: "ctr_5pct", metricValue: "3.2%", threshold: "5.0%" });
    expect(f!.message).toContain("3.2%");
    expect(f!.message).toMatch(/second consecutive month/);
  });
  it("two consecutive months below 5% is flagged as deactivation risk", () => {
    expect(evaluateCompliance({ ...good(), ctrLast30d: 0.03, ctrPrev30d: 0.04 })[0]!.message).toMatch(/deactivation risk/);
  });
  it("flags Quality Score 1-2 keywords by name", () => {
    const f = evaluateCompliance({ ...good(), keywords: [...good().keywords, { text: "bad kw here", campaign: "Main", qualityScore: 2, maxCpcUsd: 1 }] });
    expect(f).toHaveLength(1); expect(f[0]).toMatchObject({ ruleId: "quality_score_1_2", metricValue: "1" }); expect(f[0]!.message).toContain("bad kw here");
  });
  it("vanity conversions (page views) do not satisfy conversion tracking; real ones do", () => {
    expect(ids({ ...good(), conversionActions: [{ name: "Time on site", category: "PAGE_VIEW", conversionsLast30d: 900 }] })).toContain("conversion_tracking");
    expect(ids({ ...good(), conversionActions: [{ name: "Donation", category: "PURCHASE", conversionsLast30d: 0 }] })).toContain("conversion_tracking");
  });
  it("non-Smart-Bidding campaigns are flagged on modern accounts", () => {
    expect(ids({ ...good(), campaigns: [{ name: "Old", biddingStrategy: "MANUAL_CPC", adGroupCount: 2 }] })).toContain("smart_bidding");
  });
  it("accounts created before 22 Apr 2019 are exempt from conversion + Smart Bidding rules", () => {
    const legacy = { ...good(), accountCreatedAt: "2018-06-01", conversionActions: [], campaigns: [{ name: "Old", biddingStrategy: "MANUAL_CPC", adGroupCount: 2 }] };
    expect(ids(legacy)).toEqual([]);
  });
  it("enforces structure minimums and single-word keywords", () => {
    const f = ids({ ...good(), uniqueSitelinkCount: 1, campaigns: [{ name: "Main", biddingStrategy: "TARGET_CPA", adGroupCount: 1 }], keywords: [{ text: "charity", campaign: "Main", qualityScore: 8, maxCpcUsd: 1 }] });
    expect(f).toEqual(expect.arrayContaining(["min_ad_groups", "min_sitelinks", "single_word_keywords"]));
  });
  it("FALSE-POSITIVE GUARD: high CPC on a Smart Bidding account is NOT a violation", () => {
    expect(ids({ ...good(), keywords: [{ text: "donate today online", campaign: "Main", qualityScore: 9, maxCpcUsd: 40 }] })).not.toContain("cpc_cap_2usd");
  });
  it("the $2 cap DOES apply on Manual CPC / Maximize Clicks", () => {
    expect(ids({ ...good(), accountCreatedAt: "2018-01-01", campaigns: [{ name: "Main", biddingStrategy: "MAXIMIZE_CLICKS", adGroupCount: 2 }], keywords: [{ text: "donate today online", campaign: "Main", qualityScore: 9, maxCpcUsd: 3.5 }] })).toContain("cpc_cap_2usd");
  });
  it("never emits a 90-day-inactivity rule (it does not exist as commonly stated)", () => {
    const all = [evaluateCompliance({ ...good(), ctrLast30d: 0 , conversionActions: [], campaigns: [], keywords: [], uniqueSitelinkCount: 0 })].flat();
    expect(all.some((f) => /inactiv|90/i.test(f.ruleId + f.message))).toBe(false);
  });
});

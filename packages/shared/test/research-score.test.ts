import { describe, it, expect } from "vitest";
import { scoreResearchAudit, DEFAULT_WEIGHTS, type ScoreFinding, type Pillar, type Layer, type CheckResult } from "../src/research-score.js";

const f = (pillar: Pillar, layer: Layer, result: CheckResult, points: number, sourceUrl?: string): ScoreFinding =>
  ({ pillar, layer, checkId: `${pillar}-${layer}-${result}-${points}`, result, points, sourceUrl: layer === "rules" ? null : (sourceUrl ?? "https://example.org/source") });

describe("scoreResearchAudit", () => {
  it("scores a pillar with only passing rules as 100 and redistributes the empty layers", () => {
    const r = scoreResearchAudit([f("seo", "rules", "pass", 10), f("seo", "rules", "pass", 5)]);
    expect(r.pillars.seo.score).toBe(100);
    expect(r.pillars.seo.layers.rules).toEqual({ score: 100, earned: 15, available: 15 });
    expect(r.pillars.seo.missingLayers).toEqual(["reference", "peer"]);
  });

  it("scores earned over available points", () => {
    const r = scoreResearchAudit([f("seo", "rules", "pass", 10), f("seo", "rules", "fail", 10)]);
    expect(r.pillars.seo.score).toBe(50);
  });

  it("excludes could_not_check from both sides and counts it", () => {
    const r = scoreResearchAudit([f("aio", "rules", "pass", 10), f("aio", "rules", "could_not_check", 40)]);
    expect(r.pillars.aio.score).toBe(100);
    expect(r.pillars.aio.couldNotCheck).toBe(1);
  });

  it("blends the three layers 50/30/20 by default", () => {
    const r = scoreResearchAudit([
      f("uiux", "rules", "pass", 10),
      f("uiux", "reference", "fail", 10),
      f("uiux", "peer", "pass", 10),
    ]);
    expect(r.pillars.uiux.score).toBe(70); // (100*50 + 0*30 + 100*20) / 100
    expect(r.pillars.uiux.missingLayers).toEqual([]);
  });

  it("redistributes a missing layer's weight proportionally", () => {
    const r = scoreResearchAudit([f("brand", "rules", "pass", 10), f("brand", "peer", "fail", 10)]);
    expect(r.pillars.brand.score).toBe(71); // (100*50 + 0*20) / 70 = 71.43
    expect(r.pillars.brand.missingLayers).toEqual(["reference"]);
  });

  it("drops reference and peer findings that have no source", () => {
    const noSource: ScoreFinding = { pillar: "seo", layer: "reference", checkId: "x", result: "pass", points: 10, sourceUrl: null };
    const blank: ScoreFinding = { pillar: "seo", layer: "peer", checkId: "y", result: "pass", points: 10, sourceUrl: "" };
    const r = scoreResearchAudit([noSource, blank, f("seo", "rules", "fail", 10)]);
    expect(r.pillars.seo.dropped).toBe(2);
    expect(r.pillars.seo.layers.reference.score).toBeNull();
    expect(r.pillars.seo.score).toBe(0); // only the failed rules check remains
  });

  it("gives a pillar with no usable data a null score, never 0", () => {
    const r = scoreResearchAudit([f("seo", "rules", "could_not_check", 10)]);
    expect(r.pillars.seo.score).toBeNull();
    expect(r.overall).toBeNull();
    expect(r.missingPillars).toEqual(["seo", "aio", "uiux", "brand"]);
  });

  it("averages only the pillars that have a score", () => {
    const only = scoreResearchAudit([f("seo", "rules", "pass", 10)]);
    expect(only.overall).toBe(100);
    expect(only.missingPillars).toEqual(["aio", "uiux", "brand"]);
    const two = scoreResearchAudit([f("seo", "rules", "pass", 10), f("aio", "rules", "fail", 10)]);
    expect(two.overall).toBe(50);
  });

  it("applies custom pillar weights", () => {
    const weights = { layers: DEFAULT_WEIGHTS.layers, pillars: { seo: 70, aio: 10, uiux: 10, brand: 10 } };
    const r = scoreResearchAudit([f("seo", "rules", "pass", 10), f("aio", "rules", "fail", 10)], weights);
    expect(r.overall).toBe(88); // (100*70 + 0*10) / 80 = 87.5 -> 88
  });

  it("ignores a layer whose weight is 0", () => {
    const weights = { layers: { rules: 100, reference: 0, peer: 0 }, pillars: DEFAULT_WEIGHTS.pillars };
    const r = scoreResearchAudit([f("seo", "rules", "fail", 10), f("seo", "peer", "pass", 10)], weights);
    expect(r.pillars.seo.score).toBe(0);
  });

  it("throws on weights that do not sum to 100, are negative, or are not numbers", () => {
    const bad = (layers: Record<string, number>, pillars: Record<string, number> = DEFAULT_WEIGHTS.pillars) =>
      () => scoreResearchAudit([], { layers, pillars } as never);
    expect(bad({ rules: 50, reference: 30, peer: 10 })).toThrow(/sum to 100/);
    expect(bad({ rules: 120, reference: -20, peer: 0 })).toThrow(/non-negative/);
    expect(bad({ rules: Number.NaN, reference: 50, peer: 50 })).toThrow(/non-negative/);
    expect(bad(DEFAULT_WEIGHTS.layers, { seo: 25, aio: 25, uiux: 25, brand: 20 })).toThrow(/sum to 100/);
  });

  it("throws on negative or non-finite points", () => {
    expect(() => scoreResearchAudit([f("seo", "rules", "pass", -1)])).toThrow(/points/);
    expect(() => scoreResearchAudit([f("seo", "rules", "pass", Number.POSITIVE_INFINITY)])).toThrow(/points/);
  });

  it("treats a whitespace-only source as no source", () => {
    const r = scoreResearchAudit([
      { pillar: "seo", layer: "reference", checkId: "x", result: "pass", points: 10, sourceUrl: "   " },
      f("seo", "rules", "fail", 10),
    ]);
    expect(r.pillars.seo.dropped).toBe(1);
    expect(r.pillars.seo.layers.reference.score).toBeNull();
  });

  it("returns nulls for no findings at all", () => {
    const r = scoreResearchAudit([]);
    expect(r.overall).toBeNull();
    expect(r.pillars.uiux.score).toBeNull();
  });
});

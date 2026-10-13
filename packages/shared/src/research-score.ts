// Research audit scoring (docs/superpowers/specs/2026-10-13-research-audit-design.md).
// Pure and deterministic: no I/O, no LLM. Every honesty rule from the spec is enforced here.

export const PILLARS = ["seo", "aio", "uiux", "brand"] as const;
export const LAYERS = ["rules", "reference", "peer"] as const;
export type Pillar = (typeof PILLARS)[number];
export type Layer = (typeof LAYERS)[number];
export type CheckResult = "pass" | "fail" | "could_not_check";

export interface ScoreFinding {
  pillar: Pillar;
  layer: Layer;
  checkId: string;
  result: CheckResult;
  /** What this check is worth. A pass earns it; a fail earns 0; could_not_check is ignored. */
  points: number;
  /** Required for the reference and peer layers. Findings without one are dropped. */
  sourceUrl?: string | null;
}

export interface Weights { layers: Record<Layer, number>; pillars: Record<Pillar, number> }

export const DEFAULT_WEIGHTS: Weights = {
  layers: { rules: 50, reference: 30, peer: 20 },
  pillars: { seo: 25, aio: 25, uiux: 25, brand: 25 },
};

export interface LayerScore { score: number | null; earned: number; available: number }
export interface PillarScore {
  score: number | null;
  layers: Record<Layer, LayerScore>;
  /** Layers with no usable data; their weight was redistributed. */
  missingLayers: Layer[];
  couldNotCheck: number;
  /** Reference or peer findings dropped for having no source. */
  dropped: number;
}
export interface ResearchScore {
  pillars: Record<Pillar, PillarScore>;
  /** null when no pillar has a score. */
  overall: number | null;
  missingPillars: Pillar[];
}

function assertWeights(weights: Record<string, number>, label: string): void {
  const values = Object.values(weights);
  if (values.some((v) => !Number.isFinite(v) || v < 0)) throw new Error(`${label} weights must be non-negative numbers`);
  const sum = values.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 1e-9) throw new Error(`${label} weights must sum to 100 (got ${sum})`);
}

export function scoreResearchAudit(findings: ScoreFinding[], weights: Weights = DEFAULT_WEIGHTS): ResearchScore {
  assertWeights(weights.layers, "layer");
  assertWeights(weights.pillars, "pillar");
  for (const x of findings) {
    if (!Number.isFinite(x.points) || x.points < 0) throw new Error(`Invalid points for ${x.checkId}`);
  }

  const pillars = {} as Record<Pillar, PillarScore>;
  for (const pillar of PILLARS) {
    const layers = Object.fromEntries(LAYERS.map((l) => [l, { score: null, earned: 0, available: 0 }])) as Record<Layer, LayerScore>;
    let couldNotCheck = 0;
    let dropped = 0;
    for (const x of findings) {
      if (x.pillar !== pillar) continue;
      if (x.layer !== "rules" && !x.sourceUrl?.trim()) { dropped++; continue; }
      if (x.result === "could_not_check") { couldNotCheck++; continue; }
      layers[x.layer].available += x.points;
      if (x.result === "pass") layers[x.layer].earned += x.points;
    }

    let weighted = 0;
    let weightSum = 0;
    for (const l of LAYERS) {
      const layer = layers[l];
      if (layer.available <= 0) continue;
      const raw = (layer.earned / layer.available) * 100;
      layer.score = Math.round(raw);
      if (weights.layers[l] > 0) { weighted += raw * weights.layers[l]; weightSum += weights.layers[l]; }
    }
    pillars[pillar] = {
      score: weightSum > 0 ? Math.round(weighted / weightSum) : null,
      layers,
      missingLayers: LAYERS.filter((l) => layers[l].score === null),
      couldNotCheck,
      dropped,
    };
  }

  let weighted = 0;
  let weightSum = 0;
  for (const p of PILLARS) {
    const s = pillars[p].score;
    if (s === null || weights.pillars[p] <= 0) continue;
    weighted += s * weights.pillars[p];
    weightSum += weights.pillars[p];
  }
  return {
    pillars,
    overall: weightSum > 0 ? Math.round(weighted / weightSum) : null,
    missingPillars: PILLARS.filter((p) => pillars[p].score === null),
  };
}

import { DEFAULT_WEIGHTS, scoreResearchAudit, type ResearchScore } from "@sector/shared/research-score";
import { coverage } from "../report/analysis.js";
import { deriveRulesFindings, type RuleFinding, type RulesInput } from "./rules.js";

/** Bump when checks, points or weights change, so a stored score can always be explained. */
export const RESEARCH_SCORE_MODEL = "research-2026-10.1";

export function analyzeResearch(input: RulesInput): { findings: RuleFinding[]; score: ResearchScore; summary: Record<string, unknown> } {
  const findings = deriveRulesFindings(input);
  const score = scoreResearchAudit(findings, DEFAULT_WEIGHTS);
  const failed = findings.filter((f) => f.result === "fail").sort((a, b) => b.points - a.points);
  const summary = {
    scoreModel: RESEARCH_SCORE_MODEL,
    layersUsed: ["rules"],
    benchmarkNote: "Comparisons with proven organizations and live peers are not included in this score yet.",
    couldNotCheck: findings.filter((f) => f.result === "could_not_check").length,
    failed: failed.length,
    topFixes: failed.slice(0, 5).map((f) => ({ checkId: f.checkId, pillar: f.pillar, points: f.points, fix: f.fix })),
    coverage: coverage(input.report),
    notes: input.report.notes,
  };
  return { findings, score, summary };
}

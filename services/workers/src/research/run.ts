import { runAudit } from "@sector/crawler";
import { DEFAULT_WEIGHTS } from "@sector/shared/research-score";
import { scopedDb } from "@sector/db";
import { analyzeResearch } from "./analyze.js";
import { collectResearchData } from "./collect.js";

// One research audit, start to finish (specs/2026-10-13-research-audit-design.md). Runs on the "report"
// queue (concurrency 1, ADR-0007). Never throws: failures are stored on the audit. The audit ends
// in_review; only apps/api/src/lib/research-release.ts can release it.

const RESEARCH_TIMEOUT_MS = 10 * 60_000;

export interface ResearchDeps { collect: typeof collectResearchData; runAudit: typeof runAudit }
const realDeps: ResearchDeps = { collect: collectResearchData, runAudit };

export async function runResearchAuditJob(job: { auditId: string; organizationId: string }, deps: ResearchDeps = realDeps, timeoutMs = RESEARCH_TIMEOUT_MS): Promise<void> {
  const db = scopedDb(job.organizationId).researchAudits;
  const audit = await db.findById(job.auditId);
  if (!audit || audit.status !== "queued") return; // a redelivered job, or an audit that already ran
  await db.update(audit.id, { status: "running" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  const log = (stage: string) => console.log(`research ${audit.id}: ${stage} (${Math.round((Date.now() - started) / 1000)}s)`);
  // Stop waiting at the deadline even if some step ignores the abort signal.
  const deadline = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true }));
  try {
    const report = await Promise.race([deps.collect(audit.siteUrl, controller.signal, log), deadline]);
    // The plain-HTTP AI-readiness audit; if it fails the browser data still stands and those checks become could_not_check.
    const plain = await Promise.race([deps.runAudit(audit.siteUrl, { signal: controller.signal }).catch(() => null), deadline]);
    if (controller.signal.aborted) throw new Error("timeout");
    const { findings, score, summary } = analyzeResearch({ report, audit: plain });
    // One insert after analysis succeeded, so a failed audit never keeps half its findings.
    await db.addFindings(audit.id, findings.map((f) => ({ pillar: f.pillar, layer: f.layer, checkId: f.checkId, result: f.result, evidence: f.evidence, fix: f.fix, effort: f.effort, points: f.points })));
    await db.update(audit.id, {
      status: "in_review", platform: plain?.platform ?? "unknown",
      seoScore: score.pillars.seo.score, aioScore: score.pillars.aio.score, uiuxScore: score.pillars.uiux.score, brandScore: score.pillars.brand.score, overallScore: score.overall,
      layerWeights: DEFAULT_WEIGHTS.layers, pillarWeights: DEFAULT_WEIGHTS.pillars, summary,
    });
    log("in review");
  } catch (err) {
    const msg = controller.signal.aborted
      ? "Your site took too long to check. Try again later, or contact SEctOr if it keeps happening."
      : err instanceof Error && /homepage/i.test(err.message) ? err.message
      : "We could not finish this audit. Check your website is online, then try again.";
    console.error(`research ${job.auditId} failed:`, err instanceof Error ? err.message : err);
    await db.update(audit.id, { status: "failed", error: msg });
  } finally {
    clearTimeout(timer);
  }
}

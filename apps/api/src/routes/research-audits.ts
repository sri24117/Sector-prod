import type { FastifyInstance } from "fastify";
import { scopedDb, type ScopedDb } from "@sector/db";
import { authenticate, requireRole } from "../auth/middleware.js";
import { siteHost } from "../lib/site-verification.js";

// Research audit (docs/superpowers/specs/2026-10-13-research-audit-design.md): plan and ownership gate,
// and release-gated visibility. Every query goes through scopedDb(request.auth.organizationId).

export interface ResearchQueue { add(job: { auditId: string; organizationId: string }): Promise<void> }

type AuditRow = Awaited<ReturnType<ScopedDb["researchAudits"]["findById"]>> & object;

const PAID_PLANS = new Set(["pilot", "paid"]);
const DAILY_LIMIT = 3;

// What the organization may see. Scores, summary and weights appear only once the owner has released
// the audit; the internal error text, creator and organization id never appear.
export function presentAudit(row: AuditRow) {
  const released = row.status === "released" && row.releasedAt !== null;
  return {
    id: row.id, siteUrl: row.siteUrl, platform: released ? row.platform : null, status: row.status, createdAt: row.createdAt,
    releasedAt: released ? row.releasedAt : null,
    seoScore: released ? row.seoScore : null, aioScore: released ? row.aioScore : null,
    uiuxScore: released ? row.uiuxScore : null, brandScore: released ? row.brandScore : null,
    overallScore: released ? row.overallScore : null,
    layerWeights: released ? row.layerWeights : null, pillarWeights: released ? row.pillarWeights : null,
    summary: released ? row.summary : null,
  };
}

export async function registerResearchAuditRoutes(app: FastifyInstance, queue?: ResearchQueue): Promise<void> {
  const write = [authenticate, requireRole(["owner", "staff"])];

  async function ownVerifiedSite(db: ScopedDb): Promise<string | null> {
    const profile = await db.organizationProfile.get();
    if (!profile?.websiteUrl) return null;
    let host: string;
    try { host = siteHost(profile.websiteUrl); } catch { return null; }
    const verification = await db.siteVerification.get();
    return verification?.verifiedAt && verification.host === host ? profile.websiteUrl : null;
  }

  // Registered only when a queue exists, so production cannot create audits nothing will process.
  if (queue) {
    app.post("/research-audits", { preHandler: write, config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req, reply) => {
      const auth = req.auth!; const db = scopedDb(auth.organizationId);
      const org = await db.organization.get();
      if (!org || !PAID_PLANS.has(org.plan)) return reply.status(403).send({ error: "plan_required", message: "The research audit is part of the paid plan. Contact SEctOr to upgrade." });
      const siteUrl = await ownVerifiedSite(db);
      if (!siteUrl) return reply.status(403).send({ error: "site_not_verified", message: "Verify that you own your website first." });
      if ((await db.researchAudits.activeCount()) > 0) return reply.status(409).send({ error: "research_in_progress", message: "A research audit is already being prepared. It can take a while." });
      if ((await db.researchAudits.countSince(new Date(Date.now() - 86_400_000))) >= DAILY_LIMIT) {
        return reply.status(429).send({ error: "daily_limit", message: `You can request up to ${DAILY_LIMIT} research audits a day.` });
      }
      const audit = await db.researchAudits.create({ siteUrl, createdBy: auth.userId });
      try {
        await queue.add({ auditId: audit.id, organizationId: auth.organizationId });
      } catch (err) {
        req.log.error({ err }, "could not queue research audit");
        await db.researchAudits.update(audit.id, { status: "failed", error: "Could not queue the audit." });
        return reply.status(503).send({ error: "queue_unavailable", message: "We could not start the audit. Please try again shortly." });
      }
      return reply.status(202).send({ id: audit.id, status: audit.status });
    });
  }

  app.get("/research-audits", { preHandler: authenticate }, async (req) => {
    const rows = await scopedDb(req.auth!.organizationId).researchAudits.list();
    return { audits: rows.map(presentAudit) };
  });

  app.get<{ Params: { id: string } }>("/research-audits/:id", { preHandler: authenticate }, async (req, reply) => {
    const db = scopedDb(req.auth!.organizationId);
    const row = await db.researchAudits.findById(req.params.id);
    if (!row) return reply.status(404).send({ error: "not_found", message: "We could not find that audit." });
    const findings = await db.researchAudits.releasedFindings(row.id);
    return { audit: presentAudit(row), findings: findings?.map(({ id, pillar, layer, checkId, result, evidence, sourceUrl, sourceName, fix, effort, points }) => ({ id, pillar, layer, checkId, result, evidence, sourceUrl, sourceName, fix, effort, points })) ?? null };
  });
}

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { runAudit } from "@sector/crawler";
import { scopedDb } from "@sector/db";
import { authenticate, requireRole, logSecurityEvent } from "../auth/middleware.js";
import { normalizeUrl } from "./audit.js";
import { assessUrl, isSafePublicUrl } from "../lib/ssrf.js";
import { withAuditSlot, BUSY } from "../lib/audit-slots.js";

// Slice 3 (part 1): org-scoped, persisted audits. Every query goes through
// scopedDb(request.auth.organizationId) — never rawDb (CLAUDE.md §3).
export async function registerOrgAuditRoutes(app: FastifyInstance): Promise<void> {
  const write = [authenticate, requireRole(["owner", "staff"])];

  app.post("/audits", { preHandler: write, config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (request, reply) => {
    const auth = request.auth!;
    const db = scopedDb(auth.organizationId);
    const parsed = z.object({ url: z.string().min(1).optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: "invalid_input", message: "Invalid body." });

    // Own website only (full report spec): members cannot point SEctOr at other organizations' sites.
    const profile = await db.organizationProfile.get();
    if (!profile?.websiteUrl) return reply.status(400).send({ error: "url_required", message: "Add your website first." });
    if (parsed.data.url) {
      const asked = normalizeUrl(parsed.data.url.trim());
      const host = (u: string) => new URL(u).hostname.toLowerCase().replace(/^www./, "");
      if (!asked || host(asked) !== host(profile.websiteUrl)) {
        return reply.status(403).send({ error: "own_site_only", message: "Audits run on your own website. To audit a different site, change your website first." });
      }
    }
    const url = normalizeUrl(profile.websiteUrl);
    const verdict = url ? await assessUrl(url) : "blocked";
    if (verdict === "unresolvable") return reply.status(400).send({ error: "site_not_found", message: "Could not find a website at that address. Check the spelling and try again." });
    if (!url || verdict !== "ok") return reply.status(400).send({ error: "url_not_allowed", message: "That address can't be audited." });

    try {
      const slot = await withAuditSlot(() => runAudit(url, { allowUrl: isSafePublicUrl, signal: AbortSignal.timeout(15_000) }));
      if (!slot) return reply.status(503).send(BUSY);
      const result = slot.value;
      const saved = await db.audits.create({ url: result.url, score: result.score, runAt: new Date(result.runAt), checks: result.checks });
      return reply.status(201).send({ ...saved.audit, findings: saved.findings });
    } catch (err) {
      request.log.warn({ err, url }, "org audit crawl failed");
      return reply.status(502).send({ error: "crawl_failed", message: "Could not crawl that URL." });
    }
  });

  app.get("/audits", { preHandler: authenticate }, async (request) => scopedDb(request.auth!.organizationId).audits.list());

  app.get("/audits/:id", { preHandler: authenticate }, async (request, reply) => {
    const db = scopedDb(request.auth!.organizationId);
    const { id } = request.params as { id: string };
    const audit = await db.audits.findById(id);
    if (!audit) {
      // Indistinguishable from "doesn't exist" by design; logged so cross-tenant probing is visible.
      await logSecurityEvent({ organizationId: request.auth!.organizationId, userId: request.auth!.userId, action: "audit_not_found_or_foreign", result: "denied", detail: id });
      return reply.status(404).send({ error: "not_found", message: "Audit not found." });
    }
    return { ...audit, findings: await db.findings.listByAudit(audit.id) };
  });
}

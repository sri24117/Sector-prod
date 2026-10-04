import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { scopedDb } from "@sector/db";
import { authenticate, requireRole, logSecurityEvent } from "../auth/middleware.js";
import { normalizeUrl } from "./audit.js";
import { siteHost, instructions, wordpressMatches, metaTagMatches, dnsMatches } from "../lib/site-verification.js";

// Full report (docs/superpowers/specs/2026-10-04-full-report-design.md):
// website ownership, the organization's website, and paid reports. Every query
// goes through scopedDb(request.auth.organizationId).

export interface ReportQueue { add(job: { reportId: string; organizationId: string }): Promise<void> }

const PAID_PLANS = new Set(["pilot", "paid"]);
const DAILY_LIMIT = 10;
// Reports are self-contained HTML built by the worker: no scripts, only inline styles and data: images.
const REPORT_CSP = "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox";

export async function registerReportRoutes(app: FastifyInstance, queue: ReportQueue): Promise<void> {
  const write = [authenticate, requireRole(["owner", "staff"])];

  // The organization's own website. Changing it resets ownership verification.
  app.patch("/organization/profile", { preHandler: write }, async (req, reply) => {
    const p = z.object({ websiteUrl: z.string().min(1).max(500) }).safeParse(req.body);
    const url = p.success ? normalizeUrl(p.data.websiteUrl.trim()) : null;
    if (!url) return reply.status(400).send({ error: "invalid_input", message: "Enter your website address, for example yourorganization.org." });
    await scopedDb(req.auth!.organizationId).organizationProfile.upsert({ websiteUrl: url });
    return { websiteUrl: url };
  });

  async function ownSite(organizationId: string) {
    const profile = await scopedDb(organizationId).organizationProfile.get();
    if (!profile?.websiteUrl) return null;
    try { return { url: profile.websiteUrl, host: siteHost(profile.websiteUrl) }; } catch { return null; }
  }

  app.get("/site-verification", { preHandler: authenticate }, async (req, reply) => {
    const site = await ownSite(req.auth!.organizationId);
    if (!site) return reply.status(409).send({ error: "no_website", message: "Add your website first." });
    const row = await scopedDb(req.auth!.organizationId).siteVerification.ensure(site.host);
    return { host: row.host, token: row.token, verified: !!row.verifiedAt, method: row.method, verifiedAt: row.verifiedAt, ...instructions(row.token, row.host) };
  });

  app.post("/site-verification/check", { preHandler: write, config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (req, reply) => {
    const auth = req.auth!; const db = scopedDb(auth.organizationId);
    const site = await ownSite(auth.organizationId);
    if (!site) return reply.status(409).send({ error: "no_website", message: "Add your website first." });
    const row = await db.siteVerification.ensure(site.host);
    if (row.verifiedAt) return { verified: true, method: row.method, host: row.host };
    const conn = await db.platformConnections.get("wordpress");
    const method = wordpressMatches(conn?.siteUrl, site.host) ? "wordpress"
      : (await metaTagMatches(site.url, row.token)) ? "meta"
      : (await dnsMatches(site.host, row.token)) ? "dns" : null;
    if (!method) {
      await logSecurityEvent({ organizationId: auth.organizationId, userId: auth.userId, action: "site_verification_failed", result: "denied", detail: site.host });
      return reply.status(400).send({ error: "not_verified", message: "We could not find the verification code yet. Check it is on your homepage or in your DNS, then try again. DNS changes can take up to an hour." });
    }
    await db.siteVerification.markVerified(method);
    await logSecurityEvent({ organizationId: auth.organizationId, userId: auth.userId, action: "site_verified", result: "success", detail: `${site.host} via ${method}` });
    return { verified: true, method, host: site.host };
  });

  app.post("/reports", { preHandler: write, config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (req, reply) => {
    const auth = req.auth!; const db = scopedDb(auth.organizationId);
    const org = await db.organization.get();
    if (!org || !PAID_PLANS.has(org.plan)) return reply.status(403).send({ error: "plan_required", message: "The full report is part of the paid plan. Contact SEctOr to upgrade." });
    const site = await ownSite(auth.organizationId);
    const verification = await db.siteVerification.get();
    if (!site || !verification?.verifiedAt || verification.host !== site.host) {
      return reply.status(403).send({ error: "site_not_verified", message: "Verify that you own your website first." });
    }
    if ((await db.reports.activeCount()) > 0) return reply.status(409).send({ error: "report_in_progress", message: "A report is already being prepared. It usually takes a few minutes." });
    if ((await db.reports.countSince(new Date(Date.now() - 86_400_000))) >= DAILY_LIMIT) {
      return reply.status(429).send({ error: "daily_limit", message: `You can create up to ${DAILY_LIMIT} reports a day.` });
    }
    const report = await db.reports.create({ siteUrl: site.url, createdBy: auth.userId });
    try {
      await queue.add({ reportId: report.id, organizationId: auth.organizationId });
    } catch (err) {
      req.log.error({ err }, "could not queue report");
      await db.reports.update(report.id, { status: "failed", error: "Could not start the report. Try again in a few minutes.", finishedAt: new Date() });
      return reply.status(503).send({ error: "queue_unavailable", message: "Could not start the report. Try again in a few minutes." });
    }
    return reply.status(202).send(report);
  });

  app.get("/reports", { preHandler: authenticate }, async (req) => scopedDb(req.auth!.organizationId).reports.list());

  app.get("/reports/:id", { preHandler: authenticate }, async (req, reply) =>
    (await scopedDb(req.auth!.organizationId).reports.findById((req.params as { id: string }).id)) ?? reply.status(404).send({ error: "not_found", message: "Report not found." }));

  app.get("/reports/:id/html", { preHandler: authenticate }, async (req, reply) => {
    const html = await scopedDb(req.auth!.organizationId).reports.html((req.params as { id: string }).id);
    if (!html) return reply.status(404).send({ error: "not_found", message: "Report not found." });
    return reply.header("content-security-policy", REPORT_CSP).header("x-content-type-options", "nosniff").header("cache-control", "private, no-store").type("text/html; charset=utf-8").send(html);
  });

  app.get("/reports/:id/pdf", { preHandler: authenticate }, async (req, reply) => {
    const row = await scopedDb(req.auth!.organizationId).reports.pdf((req.params as { id: string }).id);
    if (!row?.pdf) return reply.status(404).send({ error: "not_found", message: "Report not found." });
    let host = "site"; try { host = siteHost(row.siteUrl); } catch { /* keep default */ }
    const name = `sector-report-${host}-${row.createdAt.toISOString().slice(0, 10)}.pdf`.replace(/[^a-zA-Z0-9.\-]/g, "-");
    return reply.header("content-disposition", `attachment; filename="${name}"`).header("cache-control", "private, no-store").type("application/pdf").send(row.pdf);
  });
}

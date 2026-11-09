import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { scopedDb, rawDb, schema } from "@sector/db";
import { eq } from "drizzle-orm";
import { authenticate, requireRole, logSecurityEvent } from "../auth/middleware.js";
import { normalizeUrl } from "./audit.js";
import { requireFeature } from "../auth/plan.js";
import { siteHost, instructions, wordpressMatches, metaTagMatches, dnsMatches } from "../lib/site-verification.js";

// Full report (docs/superpowers/specs/2026-10-04-full-report-design.md):
// website ownership, the organization's website, and paid reports. Every query
// goes through scopedDb(request.auth.organizationId).

export interface ReportQueue { add(job: { reportId: string; organizationId: string }): Promise<void> }

const DAILY_LIMIT = 10;
// Reports are self-contained HTML built by the worker: no scripts, only inline styles and data: images.
const REPORT_CSP = "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox";

export async function registerReportRoutes(app: FastifyInstance, queue: ReportQueue): Promise<void> {
  const write = [authenticate, requireRole(["owner", "staff"])];

  // View organization details and statutory profile (Screen A16).
  app.get("/organization/profile", { preHandler: authenticate }, async (req, reply) => {
    const db = scopedDb(req.auth!.organizationId);
    const [org, profile] = await Promise.all([db.organization.get(), db.organizationProfile.get()]);
    if (!org) return reply.status(404).send({ error: "not_found", message: "Organization not found." });
    return {
      organizationId: org.id,
      name: org.name,
      plan: org.plan,
      orgType: profile?.orgType ?? null,
      websiteUrl: profile?.websiteUrl ?? null,
      panNumber: profile?.panNumber ?? null,
      section12ANumber: profile?.section12ANumber ?? null,
      section80GNumber: profile?.section80GNumber ?? null,
      fcraSelfDeclared: profile?.fcraSelfDeclared ?? false,
      fcraRegistrationNo: profile?.fcraRegistrationNo ?? null,
      fcraConfirmedAt: profile?.fcraConfirmedAt ?? null,
    };
  });

  // Edit organization details, website, and statutory fields (Screen A16).
  // fcraConfirmedAt is never editable through API routes (internal ops only).
  app.patch("/organization/profile", { preHandler: write }, async (req, reply) => {
    const p = z.object({
      name: z.string().min(2).max(200).optional(),
      orgType: z.string().max(50).nullable().optional(),
      websiteUrl: z.string().max(500).nullable().optional(),
      panNumber: z.string().max(30).nullable().optional(),
      section12ANumber: z.string().max(50).nullable().optional(),
      section80GNumber: z.string().max(50).nullable().optional(),
      fcraSelfDeclared: z.boolean().optional(),
      fcraRegistrationNo: z.string().max(50).nullable().optional(),
    }).safeParse(req.body);

    if (!p.success) {
      return reply.status(400).send({ error: "invalid_input", message: "Please check the profile details you entered." });
    }

    const { name, ...profileFields } = p.data;
    const db = scopedDb(req.auth!.organizationId);

    if (name) {
      await rawDb.update(schema.organizations).set({ name: name.trim(), updatedAt: new Date() }).where(eq(schema.organizations.id, req.auth!.organizationId));
    }

    const updates: Partial<typeof schema.organizationProfiles.$inferInsert> = {};
    if (profileFields.orgType !== undefined) updates.orgType = profileFields.orgType;
    if (profileFields.panNumber !== undefined) updates.panNumber = profileFields.panNumber?.trim() || null;
    if (profileFields.section12ANumber !== undefined) updates.section12ANumber = profileFields.section12ANumber?.trim() || null;
    if (profileFields.section80GNumber !== undefined) updates.section80GNumber = profileFields.section80GNumber?.trim() || null;
    if (profileFields.fcraSelfDeclared !== undefined) updates.fcraSelfDeclared = profileFields.fcraSelfDeclared;
    if (profileFields.fcraRegistrationNo !== undefined) updates.fcraRegistrationNo = profileFields.fcraRegistrationNo?.trim() || null;

    if (profileFields.websiteUrl !== undefined) {
      const trimmed = profileFields.websiteUrl ? profileFields.websiteUrl.trim() : "";
      const url = trimmed ? normalizeUrl(trimmed) : null;
      if (trimmed && !url) {
        return reply.status(400).send({ error: "invalid_input", message: "Enter a valid website address, for example yourorganization.org." });
      }
      updates.websiteUrl = url;
    }

    if (Object.keys(updates).length > 0) {
      await db.organizationProfile.upsert(updates);
    }

    const [updatedOrg, updatedProfile] = await Promise.all([db.organization.get(), db.organizationProfile.get()]);
    return {
      organizationId: updatedOrg!.id,
      name: updatedOrg!.name,
      plan: updatedOrg!.plan,
      orgType: updatedProfile?.orgType ?? null,
      websiteUrl: updatedProfile?.websiteUrl ?? null,
      panNumber: updatedProfile?.panNumber ?? null,
      section12ANumber: updatedProfile?.section12ANumber ?? null,
      section80GNumber: updatedProfile?.section80GNumber ?? null,
      fcraSelfDeclared: updatedProfile?.fcraSelfDeclared ?? false,
      fcraRegistrationNo: updatedProfile?.fcraRegistrationNo ?? null,
      fcraConfirmedAt: updatedProfile?.fcraConfirmedAt ?? null,
    };
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

  app.post("/reports", { preHandler: [...write, requireFeature("full_report")], config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (req, reply) => {
    const auth = req.auth!; const db = scopedDb(auth.organizationId);
    const site = await ownSite(auth.organizationId);
    const verification = await db.siteVerification.get();
    if (!site || !verification?.verifiedAt || verification.host !== site.host) {
      return reply.status(403).send({ error: "site_not_verified", message: "Verify that you own your website first." });
    }
    const admission = await db.reports.admit({ siteUrl: site.url, createdBy: auth.userId }, DAILY_LIMIT);
    if (admission.error === "report_in_progress") return reply.status(409).send({ error: admission.error, message: "A report is already being prepared." });
    if (admission.error === "daily_limit") return reply.status(429).send({ error: admission.error, message: `You can create up to ${DAILY_LIMIT} reports a day.` });
    const report = admission.report!;
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
    const name = `sector-report-${host}-${row.createdAt.toISOString().slice(0, 10)}.pdf`.replace(/[^a-zA-Z0-9.-]/g, "-");
    return reply.header("content-disposition", `attachment; filename="${name}"`).header("cache-control", "private, no-store").type("application/pdf").send(row.pdf);
  });
}

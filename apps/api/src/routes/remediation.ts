import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { runAudit } from "@sector/crawler";
import { verifyWordPressCredentials, applyJsonLdSchema, type WordPressCredentials } from "@sector/connectors";
import { scopedDb } from "@sector/db";
import { authenticate, requireRole, logSecurityEvent } from "../auth/middleware.js";
import { encryptJson, decryptJson } from "../lib/crypto.js";
import { isSafePublicUrl } from "../lib/ssrf.js";
import { normalizeUrl } from "./audit.js";
import { buildOrganizationJsonLd, manualFixPackage } from "../remediation/fixes.js";

// Slice 3: finding -> proposed fix -> applied fix (WordPress) -> re-crawl -> RemediationLog.
export async function registerRemediationRoutes(app: FastifyInstance): Promise<void> {
  const write = [authenticate, requireRole(["owner", "staff"])];

  app.post("/connections/wordpress", { preHandler: write, config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const auth = request.auth!;
    const parsed = z.object({ siteUrl: z.string().min(1), username: z.string().min(1), applicationPassword: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_input", message: "siteUrl, username and applicationPassword are required." });
    const siteUrl = normalizeUrl(parsed.data.siteUrl);
    if (!siteUrl || !(await isSafePublicUrl(siteUrl))) return reply.status(400).send({ error: "url_not_allowed", message: "That address can't be connected." });

    const creds: WordPressCredentials = { siteUrl, username: parsed.data.username, applicationPassword: parsed.data.applicationPassword };
    try {
      await verifyWordPressCredentials(creds);
    } catch (err) {
      await logSecurityEvent({ organizationId: auth.organizationId, userId: auth.userId, action: "wordpress_connect_failed", result: "denied" });
      return reply.status(400).send({ error: "connection_failed", message: err instanceof Error ? err.message : "Could not verify the WordPress connection." });
    }
    const row = await scopedDb(auth.organizationId).platformConnections.upsert({ provider: "wordpress", siteUrl, credentialsEncrypted: encryptJson(creds) });
    await logSecurityEvent({ organizationId: auth.organizationId, userId: auth.userId, action: "wordpress_connected", result: "success" });
    // Credentials are never returned.
    return reply.status(201).send({ provider: row.provider, siteUrl: row.siteUrl, status: row.status });
  });

  app.get("/connections/wordpress", { preHandler: authenticate }, async (request, reply) => {
    const row = await scopedDb(request.auth!.organizationId).platformConnections.get("wordpress");
    if (!row) return reply.status(404).send({ error: "not_found", message: "No WordPress connection." });
    return { provider: row.provider, siteUrl: row.siteUrl, status: row.status };
  });

  app.post("/findings/:id/remediate", { preHandler: write, config: { rateLimit: { max: 30, timeWindow: "1 hour" } } }, async (request, reply) => {
    const auth = request.auth!;
    const db = scopedDb(auth.organizationId);
    const { id } = request.params as { id: string };

    const finding = await db.findings.findById(id);
    if (!finding) {
      await logSecurityEvent({ organizationId: auth.organizationId, userId: auth.userId, action: "finding_not_found_or_foreign", result: "denied", detail: id });
      return reply.status(404).send({ error: "not_found", message: "Finding not found." });
    }
    if (finding.passed) return reply.status(409).send({ error: "already_passing", message: "This check already passes." });
    const audit = await db.audits.findById(finding.auditId);

    // No live-fix mechanism for this check: issue the manual package, and log it honestly as manual.
    if (finding.checkId !== "schema") {
      const pkg = manualFixPackage(finding.checkId);
      await db.remediationLogs.create({ findingId: finding.id, platform: "manual", action: `manual_${finding.checkId}`, payload: pkg, beforeScore: audit?.score ?? null, status: "manual_package_issued" });
      return { mode: "manual", package: pkg };
    }

    const conn = await db.platformConnections.get("wordpress");
    if (!conn) return reply.status(409).send({ error: "no_connection", message: "Connect your WordPress site first." });

    try {
      const creds = decryptJson<WordPressCredentials>(conn.credentialsEncrypted);
      // Guardrail (skill §6): re-verify this org's credentials immediately before touching a live site.
      if (!(await isSafePublicUrl(creds.siteUrl))) throw new Error("Connection target is not allowed.");
      await verifyWordPressCredentials(creds);

      const [org, profile] = await Promise.all([db.organization.get(), db.organizationProfile.get()]);
      const jsonLd = buildOrganizationJsonLd({ name: org!.name, websiteUrl: profile?.websiteUrl }, creds.siteUrl);
      await applyJsonLdSchema(creds, jsonLd);

      const after = await runAudit(creds.siteUrl, { allowUrl: isSafePublicUrl, signal: AbortSignal.timeout(15_000) });
      await db.audits.create({ url: after.url, score: after.score, runAt: new Date(after.runAt), checks: after.checks });
      const verified = after.checks.find((c) => c.checkId === "schema")?.passed === true;

      const log = await db.remediationLogs.create({
        findingId: finding.id, platform: "wordpress", action: "apply_jsonld_schema", payload: jsonLd,
        beforeScore: audit?.score ?? null, afterScore: after.score, status: verified ? "verified" : "applied_unverified",
        detail: verified ? "Schema present on re-crawl." : "Applied, but the re-crawl did not detect the schema.",
      });
      return { mode: "applied", status: log.status, beforeScore: log.beforeScore, afterScore: log.afterScore, remediationLogId: log.id };
    } catch (err) {
      request.log.error({ err }, "remediation failed");
      await db.remediationLogs.create({ findingId: finding.id, platform: "wordpress", action: "apply_jsonld_schema", beforeScore: audit?.score ?? null, status: "failed", detail: "Could not apply the fix." });
      return reply.status(502).send({ error: "remediation_failed", message: "Could not apply the fix to your site. Nothing was changed." });
    }
  });

  app.get("/remediations", { preHandler: authenticate }, async (request) => scopedDb(request.auth!.organizationId).remediationLogs.list());
}

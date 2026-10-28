import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { runAudit } from "@sector/crawler";
import { verifyWordPressCredentials, applyJsonLdSchema, readJsonLdSchema, type WordPressCredentials } from "@sector/connectors";
import { scopedDb } from "@sector/db";
import { authenticate, requireRole, logSecurityEvent } from "../auth/middleware.js";
import { requireFeature, denyUnlessFeature } from "../auth/plan.js";
import { encryptJson, decryptJson } from "../lib/crypto.js";
import { isSafePublicUrl } from "../lib/ssrf.js";
import { normalizeUrl } from "./audit.js";
import { buildOrganizationJsonLd, manualFixPackage } from "../remediation/fixes.js";

// The connector sends the Application Password as a Basic auth header, so only over https.
// The one exception is a loopback mock site in local dev/tests (ALLOW_PRIVATE_TARGETS=1): it never leaves the machine.
const HTTPS_REQUIRED = "Your website address must start with https:// to connect WordPress safely. Turn on HTTPS (an SSL certificate) for your site with your web host, then connect again using the https:// address.";
function credentialsMaySendTo(siteUrl: string): boolean {
  const u = new URL(siteUrl);
  if (u.protocol === "https:") return true;
  return process.env.ALLOW_PRIVATE_TARGETS === "1" && /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(u.hostname);
}

// Slice 3: finding -> proposed fix -> applied fix (WordPress) -> re-crawl -> RemediationLog.
export async function registerRemediationRoutes(app: FastifyInstance): Promise<void> {
  const write = [authenticate, requireRole(["owner", "staff"])];

  app.post("/connections/wordpress", { preHandler: [...write, requireFeature("wordpress_fix")], config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const auth = request.auth!;
    const parsed = z.object({ siteUrl: z.string().min(1), username: z.string().min(1), applicationPassword: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_input", message: "siteUrl, username and applicationPassword are required." });
    const siteUrl = normalizeUrl(parsed.data.siteUrl);
    if (!siteUrl || !(await isSafePublicUrl(siteUrl))) return reply.status(400).send({ error: "url_not_allowed", message: "That address can't be connected." });
    if (!credentialsMaySendTo(siteUrl)) return reply.status(400).send({ error: "https_required", message: HTTPS_REQUIRED });

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

  const siteIdentity = (url: string) => { const u = new URL(url); return u.origin + u.pathname.replace(/\/+$/, ""); };
  const sameSite = (...urls: (string | null | undefined)[]) => { try { return urls.every((u) => !!u && siteIdentity(u) === siteIdentity(urls[0]!)); } catch { return false; } };
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : value;
  const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
  async function proposal(organizationId: string, id: string) {
    const db = scopedDb(organizationId), finding = await db.findings.findById(id);
    if (!finding) return { error: "not_found", status: 404, message: "Finding not found." } as const;
    const audit = await db.audits.findById(finding.auditId), conn = await db.platformConnections.get("wordpress"), profile = await db.organizationProfile.get();
    if (!conn) return { error: "no_connection", status: 409, message: "Connect your WordPress site first." } as const;
    if (!audit || !sameSite(audit.url, profile?.websiteUrl, conn.siteUrl)) return { error: "site_mismatch", status: 409, message: "The audit, organization website and WordPress connection must match. Reconnect and run a fresh audit." } as const;
    const creds = decryptJson<WordPressCredentials>(conn.credentialsEncrypted);
    if (!sameSite(creds.siteUrl, conn.siteUrl) || !credentialsMaySendTo(creds.siteUrl) || !await isSafePublicUrl(creds.siteUrl)) return { error: "site_mismatch", status: 409, message: "Connection target is not allowed." } as const;
    await verifyWordPressCredentials(creds);
    const org = await db.organization.get(), previous = await readJsonLdSchema(creds);
    const jsonLd = buildOrganizationJsonLd({ name: org!.name, websiteUrl: profile?.websiteUrl }, creds.siteUrl);
    const payload = { siteUrl: creds.siteUrl, previous, jsonLd };
    return { finding, audit, creds, payload, approvalToken: fingerprint({ id, connectionId: conn.id, ...payload }) };
  }

  app.get("/findings/:id/proposal", { preHandler: [...write, requireFeature("wordpress_fix")] }, async (req, reply) => {
    try {
      const p = await proposal(req.auth!.organizationId, (req.params as { id: string }).id);
      if ("error" in p) return reply.status(p.status ?? 409).send(p);
      return { ...p.payload, approvalToken: p.approvalToken, supported: p.finding.checkId === "schema", restoreAvailable: true };
    } catch { return reply.status(502).send({ error: "proposal_unavailable", message: "Could not read the site safely. Check the connection and update the companion plugin." }); }
  });

  app.post("/findings/:id/remediate", { preHandler: write, config: { rateLimit: { max: 30, timeWindow: "1 hour" } } }, async (request, reply) => {
    const auth = request.auth!, db = scopedDb(auth.organizationId), id = (request.params as { id: string }).id;
    const finding = await db.findings.findById(id);
    if (!finding) { await logSecurityEvent({ organizationId: auth.organizationId, userId: auth.userId, action: "finding_not_found_or_foreign", result: "denied", detail: id }); return reply.status(404).send({ error: "not_found", message: "Finding not found." }); }
    const input = z.object({ mode: z.enum(["manual", "apply"]).default("apply"), approvalToken: z.string().optional() }).safeParse(request.body ?? {});
    if (!input.success) return reply.status(400).send({ error: "invalid_input", message: "Invalid fix request." });
    if (input.data.mode === "manual" || finding.checkId !== "schema") return { mode: "manual", package: manualFixPackage(finding.checkId) };
    if (finding.passed) return reply.status(409).send({ error: "already_passing", message: "This check already passes." });
    if (await denyUnlessFeature(request, reply, "wordpress_fix")) return reply;
    let logId: string | undefined, attempted = false, applied = false;
    try {
      const p = await proposal(auth.organizationId, id);
      if ("error" in p) return reply.status(p.status ?? 409).send(p);
      if (input.data.approvalToken !== p.approvalToken) return reply.status(409).send({ error: "review_required", message: "Review the current target and change before applying." });
      const reserved = await db.remediationLogs.begin(id, p.payload, p.audit.score);
      if (reserved.previous) return reply.status(409).send({ error: "already_attempted", message: "A change was already attempted for this finding. Check its history and run a fresh audit; do not apply it again.", status: reserved.previous.status });
      logId = reserved.log!.id;
      attempted = true;
      await applyJsonLdSchema(p.creds, p.payload.jsonLd, p.payload.previous);
      applied = true;
      await db.remediationLogs.update(logId, { status: "applied_unverified", detail: "Change accepted by WordPress; verification pending." });
      const after = await runAudit(p.creds.siteUrl, { allowUrl: isSafePublicUrl, signal: AbortSignal.timeout(15_000) });
      await db.audits.create({ url: after.url, score: after.score, runAt: new Date(after.runAt), checks: after.checks });
      const current = await readJsonLdSchema(p.creds);
      const verified = fingerprint(current) === fingerprint(p.payload.jsonLd) && after.checks.some((c) => c.checkId === "schema" && c.passed);
      const log = await db.remediationLogs.update(logId, { status: verified ? "verified" : "applied_unverified", afterScore: after.score, detail: verified ? "Approved schema saved; structured data detected on the public page." : "Change saved; public verification is incomplete." });
      return { mode: "applied", status: log!.status, beforeScore: p.audit.score, afterScore: after.score, remediationLogId: logId };
    } catch (err) {
      request.log.error({ err }, "remediation incomplete");
      const status = applied ? "applied_unverified" : attempted ? "outcome_unknown" : "failed";
      if (logId) await db.remediationLogs.update(logId, { status, detail: applied ? "Change saved; verification failed." : "Check WordPress before retrying." });
      if (applied) return { mode: "applied", status, remediationLogId: logId, message: "The change was saved. Verification failed; check the public page before continuing." };
      return reply.status(502).send({ error: status, message: attempted ? "WordPress may have received the change. Check its current state before retrying." : "Could not prepare the change. Check the connection." });
    }
  });

  app.post("/remediations/:id/restore", { preHandler: [...write, requireFeature("wordpress_fix")] }, async (req, reply) => {
    const db = scopedDb(req.auth!.organizationId), row = await db.remediationLogs.findById((req.params as { id: string }).id);
    if (!row) return reply.status(404).send({ error: "not_found", message: "Change record not found." });
    if (!["verified", "applied_unverified"].includes(row.status)) return reply.status(409).send({ error: "invalid_state", message: "This change cannot be restored automatically. Review its current state first." });
    const approved = z.object({ confirm: z.literal(true) }).safeParse(req.body);
    if (!approved.success) return reply.status(400).send({ error: "confirmation_required", message: "Review and confirm restoration first." });
    const saved = row.payload as { siteUrl: string; previous: Record<string, unknown> | null; jsonLd: Record<string, unknown> };
    try {
      const p = await proposal(req.auth!.organizationId, row.findingId);
      if ("error" in p) return reply.status(p.status ?? 409).send(p);
      if (!saved?.siteUrl || !sameSite(saved.siteUrl, p.creds.siteUrl) || fingerprint(p.payload.previous) !== fingerprint(saved.jsonLd)) return reply.status(409).send({ error: "stale_schema", message: "The website value changed. Review it manually before restoring." });
      await applyJsonLdSchema(p.creds, saved.previous, saved.jsonLd);
      await db.remediationLogs.update(row.id, { status: "restored", detail: "Previous companion-plugin schema restored. Check the public site after cache refresh." });
      return { status: "restored", message: "Previous plugin value restored. Check your public page after refreshing any cache." };
    } catch {
      await db.remediationLogs.update(row.id, { status: "restore_unknown", detail: "Restore outcome could not be confirmed. Check the site before retrying." });
      return reply.status(502).send({ error: "restore_unknown", message: "Restore outcome could not be confirmed. Check WordPress before retrying." });
    }
  });

  app.get("/remediations", { preHandler: authenticate }, async (request) => scopedDb(request.auth!.organizationId).remediationLogs.list());
}

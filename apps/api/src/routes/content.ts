import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { scopedDb } from "@sector/db";
import { generate, NotConfiguredError, providerFromEnv, type LlmProvider } from "@sector/ai";
import { authenticate, requireRole, logSecurityEvent } from "../auth/middleware.js";
import { missingConsent, pseudonymize, restore, type AssetKind } from "../content/consent.js";

// Slice 5: brand kit + consent records + content generation. The gate: an asset that names a beneficiary
// cannot be EXPORTED without an active, sufficiently-scoped ConsentRecord for that person in THIS org.
export async function registerContentRoutes(app: FastifyInstance, providerOverride?: LlmProvider): Promise<void> {
  const write = [authenticate, requireRole(["owner", "staff"])];
  const getProvider = () => providerOverride ?? providerFromEnv();

  // ---- Brand kit ----
  app.get("/brand-kit", { preHandler: authenticate }, async (req, reply) => (await scopedDb(req.auth!.organizationId).brandKit.get()) ?? reply.status(404).send({ error: "not_found", message: "No brand kit yet." }));
  app.put("/brand-kit", { preHandler: write }, async (req, reply) => {
    const p = z.object({ voice: z.string().min(10).max(4000), tokens: z.record(z.unknown()).optional() }).safeParse(req.body);
    if (!p.success) return reply.status(400).send({ error: "invalid_input", message: "voice (10+ characters) is required." });
    return scopedDb(req.auth!.organizationId).brandKit.upsert(p.data);
  });

  // ---- Consent records ----
  app.post("/consents", { preHandler: write }, async (req, reply) => {
    const p = z.object({ subjectName: z.string().min(2).max(200), scope: z.enum(["story", "quote", "photo", "all"]), evidenceNote: z.string().min(3).max(1000) }).safeParse(req.body);
    if (!p.success) return reply.status(400).send({ error: "invalid_input", message: "subjectName, scope (story|quote|photo|all) and evidenceNote (how consent was obtained) are required." });
    const row = await scopedDb(req.auth!.organizationId).consentRecords.create(p.data);
    await logSecurityEvent({ organizationId: req.auth!.organizationId, userId: req.auth!.userId, action: "consent_recorded", result: "success", detail: row.id });
    return reply.status(201).send(row);
  });
  app.get("/consents", { preHandler: authenticate }, async (req) => scopedDb(req.auth!.organizationId).consentRecords.list());
  app.post("/consents/:id/revoke", { preHandler: write }, async (req, reply) => {
    const row = await scopedDb(req.auth!.organizationId).consentRecords.revoke((req.params as { id: string }).id);
    if (!row) return reply.status(404).send({ error: "not_found", message: "Consent record not found." });
    await logSecurityEvent({ organizationId: req.auth!.organizationId, userId: req.auth!.userId, action: "consent_revoked", result: "success", detail: row.id });
    return row;
  });

  // ---- Content ----
  app.post("/content/generate", { preHandler: write, config: { rateLimit: { max: 30, timeWindow: "1 hour" } } }, async (req, reply) => {
    const auth = req.auth!; const db = scopedDb(auth.organizationId);
    const p = z.object({
      kind: z.enum(["case_study", "social_post", "quote"]), topic: z.string().min(3).max(300),
      facts: z.array(z.string().min(1).max(1000)).min(1).max(20),
      beneficiaries: z.array(z.string().min(2).max(200)).max(10).default([]),
      noBeneficiaryIdentified: z.boolean().optional(),
    }).safeParse(req.body);
    if (!p.success) return reply.status(400).send({ error: "invalid_input", message: "kind, topic and at least one fact are required." });
    const { kind, topic, facts, beneficiaries, noBeneficiaryIdentified } = p.data;

    // Story-type assets are the highest consent risk: omission of beneficiaries must be an explicit statement, not a default.
    if (beneficiaries.length === 0 && noBeneficiaryIdentified !== true && (kind === "case_study" || kind === "quote")) {
      return reply.status(400).send({ error: "beneficiary_declaration_required", message: "List the beneficiaries this features, or confirm noBeneficiaryIdentified." });
    }

    let provider: LlmProvider;
    try { provider = getProvider(); } catch (e) { if (e instanceof NotConfiguredError) return reply.status(501).send({ error: "not_yet_available", message: "Content generation is not enabled yet." }); throw e; }

    const [org, kit] = await Promise.all([db.organization.get(), db.brandKit.get()]);
    const src = pseudonymize([`Topic: ${topic}`, "Facts:", ...facts.map((f) => `- ${f}`)].join("\n"), beneficiaries);
    const system = [
      `You write ${kind.replace("_", " ")} drafts for the NGO "${org!.name}".`,
      `Brand voice: ${kit?.voice ?? "clear, warm, factual"}.`,
      "Use ONLY the facts provided. Do not invent statistics, quotes, names, places or outcomes. Refer to people only by the placeholders given (e.g. [BENEFICIARY_1]). If the facts are insufficient, say what is missing.",
      "Output the draft text only, no preamble.",
    ].join("\n");

    try {
      const out = await generate({ skillId: "content-creator-comms", organizationId: auth.organizationId, system, prompt: src.text }, provider);
      const asset = await db.contentAssets.create({ kind, title: topic.slice(0, 120), body: restore(out.text, src.map), beneficiaryRefs: beneficiaries, status: "draft", createdBy: auth.userId, model: out.model });
      return reply.status(201).send(asset);
    } catch (err) {
      req.log.error({ err }, "content generation failed");
      return reply.status(502).send({ error: "generation_failed", message: "Could not generate a draft." });
    }
  });

  app.get("/content", { preHandler: authenticate }, async (req) => scopedDb(req.auth!.organizationId).contentAssets.list());
  app.get("/content/:id", { preHandler: authenticate }, async (req, reply) =>
    (await scopedDb(req.auth!.organizationId).contentAssets.findById((req.params as { id: string }).id)) ?? reply.status(404).send({ error: "not_found", message: "Asset not found." }));

  // Human approval is a required step before export: the residual risk (a name typed into free-text facts but not declared) can't be caught deterministically.
  app.post("/content/:id/approve", { preHandler: write }, async (req, reply) => {
    const db = scopedDb(req.auth!.organizationId);
    const asset = await db.contentAssets.findById((req.params as { id: string }).id);
    if (!asset) return reply.status(404).send({ error: "not_found", message: "Asset not found." });
    if (asset.status !== "draft") return reply.status(409).send({ error: "invalid_state", message: `Asset is already ${asset.status}.` });
    return db.contentAssets.setStatus(asset.id, "approved");
  });

  app.post("/content/:id/export", { preHandler: write }, async (req, reply) => {
    const auth = req.auth!; const db = scopedDb(auth.organizationId);
    const asset = await db.contentAssets.findById((req.params as { id: string }).id);
    if (!asset) return reply.status(404).send({ error: "not_found", message: "Asset not found." });
    if (asset.status === "draft") return reply.status(409).send({ error: "not_approved", message: "Approve this draft before exporting." });

    // THE GATE — evaluated at export time, so a consent revoked after approval still blocks.
    const missing = missingConsent(asset.beneficiaryRefs, asset.kind as AssetKind, await db.consentRecords.listActive());
    if (missing.length) {
      await logSecurityEvent({ organizationId: auth.organizationId, userId: auth.userId, action: "export_blocked_no_consent", result: "denied", detail: asset.id });
      return reply.status(403).send({ error: "consent_required", message: "Export blocked: no active consent on file for the people featured.", missingConsentFor: missing });
    }
    await db.contentAssets.setStatus(asset.id, "exported");
    return { id: asset.id, status: "exported", title: asset.title, body: asset.body };
  });
}

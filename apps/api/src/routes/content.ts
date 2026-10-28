import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { scopedDb } from "@sector/db";
import { generate, NotConfiguredError, providerFromEnv, type LlmProvider } from "@sector/ai";
import { authenticate, requireRole, logSecurityEvent } from "../auth/middleware.js";
import { requireFeature } from "../auth/plan.js";
import { CONTENT_ALLOWANCE, monthStartIst, normalizePlan } from "@sector/shared/plans";
import { missingConsent, pseudonymize, restore, type AssetKind } from "../content/consent.js";

// Slice 5: brand kit + consent records + content generation. The gate: an asset that names a beneficiary
// cannot be EXPORTED without an active, sufficiently-scoped ConsentRecord for that person in THIS org.
export async function registerContentRoutes(app: FastifyInstance, providerOverride?: LlmProvider): Promise<void> {
  // Every route here is part of the Starter plan and above; the monthly generation allowance is checked in /content/generate.
  const plan = requireFeature("content");
  const read = [authenticate, plan];
  const write = [authenticate, requireRole(["owner", "staff"]), plan];
  const getProvider = () => providerOverride ?? providerFromEnv();

  // ---- Brand kit ----
  app.get("/brand-kit", { preHandler: read }, async (req, reply) => (await scopedDb(req.auth!.organizationId).brandKit.get()) ?? reply.status(404).send({ error: "not_found", message: "No brand kit yet." }));
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
  app.get("/consents", { preHandler: read }, async (req) => scopedDb(req.auth!.organizationId).consentRecords.list());
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
    // Check-then-act: two requests arriving together can both pass this check, so the cap can be exceeded by a draft or two. Only a stored draft counts, so a failed generation never uses the allowance.
    const allowance = CONTENT_ALLOWANCE[normalizePlan(org!.plan)];
    if (allowance !== null && (await db.contentAssets.countSince(monthStartIst())) >= allowance) {
      return reply.status(429).send({ error: "content_allowance_reached", message: `Your plan includes ${allowance} generated pieces of content a month and you have used them. The allowance resets at the start of next month; contact SEctOr if you need more.` });
    }
    const protect = (value: string) => pseudonymize(value, beneficiaries);
    const safe = { name: protect(org!.name).text, voice: protect(kit?.voice ?? "clear, warm, factual").text, topic: protect(topic).text, facts: facts.map((f) => protect(f).text) };
    const src = { text: [`Topic: ${safe.topic}`, "Facts:", ...safe.facts.map((f) => `- ${f}`)].join("\n"), map: protect("").map };
    const system = [
      `You write ${kind.replace("_", " ")} drafts for the NGO "${safe.name}".`,
      `Brand voice: ${safe.voice}.`,
      "Use ONLY the facts provided. Do not invent statistics, quotes, names, places or outcomes. Refer to people only by the placeholders given (e.g. [BENEFICIARY_1]). If the facts are insufficient, say what is missing.",
      "Output the draft text only, no preamble.",
    ].join("\n");

    try {
      const out = await generate({ skillId: "content-creator-comms", organizationId: auth.organizationId, system, prompt: src.text }, provider);
      const asset = await db.contentAssets.createWithinAllowance({ kind, title: topic.slice(0, 120), body: restore(out.text, src.map), beneficiaryRefs: beneficiaries, facts, status: "draft", createdBy: auth.userId, model: out.model }, allowance, monthStartIst());
      if (!asset) return reply.status(429).send({ error: "content_allowance_reached", message: "Your monthly content allowance has been reached." });
      return reply.status(201).send(asset);
    } catch (err) {
      req.log.error({ err }, "content generation failed");
      return reply.status(502).send({ error: "generation_failed", message: "Could not generate a draft." });
    }
  });

  // Manual drafting is deliberately available without an AI provider for the pilot.
  const draftInput = z.object({
    kind: z.enum(["case_study", "social_post", "quote"]), title: z.string().trim().min(3).max(120),
    body: z.string().trim().min(3).max(20000), facts: z.array(z.string().trim().min(1).max(1000)).min(1).max(20),
    beneficiaryRefs: z.array(z.string().trim().min(2).max(200)).max(10), noBeneficiaryIdentified: z.boolean().optional(),
  });
  app.post("/content", { preHandler: write }, async (req, reply) => {
    const p = draftInput.safeParse(req.body);
    if (!p.success || (!p.data.beneficiaryRefs.length && !p.data.noBeneficiaryIdentified)) return reply.status(400).send({ error: "invalid_input", message: "Provide a title, draft, source facts, and the people featured or an explicit declaration that nobody is identified." });
    const db = scopedDb(req.auth!.organizationId), org = await db.organization.get();
    const { noBeneficiaryIdentified: _declaration, ...data } = p.data;
    const asset = await db.contentAssets.createWithinAllowance({ ...data, status: "draft", createdBy: req.auth!.userId, model: "manual" }, CONTENT_ALLOWANCE[normalizePlan(org!.plan)], monthStartIst());
    if (!asset) return reply.status(429).send({ error: "content_allowance_reached", message: "Your monthly content allowance has been reached." });
    return reply.status(201).send(asset);
  });
  app.patch("/content/:id", { preHandler: write }, async (req, reply) => {
    const p = draftInput.omit({ kind: true }).extend({ revision: z.number().int().positive() }).safeParse(req.body);
    if (!p.success || (!p.data.beneficiaryRefs.length && !p.data.noBeneficiaryIdentified)) return reply.status(400).send({ error: "invalid_input", message: "Provide the current revision, draft, source facts, and beneficiary declaration." });
    const db = scopedDb(req.auth!.organizationId), id = (req.params as { id: string }).id;
    if (!await db.contentAssets.findById(id)) return reply.status(404).send({ error: "not_found", message: "Asset not found." });
    const { revision, noBeneficiaryIdentified: _declaration, ...data } = p.data;
    const asset = await db.contentAssets.edit(id, revision, data);
    return asset ?? reply.status(409).send({ error: "stale_revision", message: "This draft changed in another session. Reload it before saving again." });
  });

  app.get("/content", { preHandler: read }, async (req) => scopedDb(req.auth!.organizationId).contentAssets.list());
  app.get("/content/:id", { preHandler: read }, async (req, reply) =>
    (await scopedDb(req.auth!.organizationId).contentAssets.findById((req.params as { id: string }).id)) ?? reply.status(404).send({ error: "not_found", message: "Asset not found." }));

  // Human approval is a required step before export: the residual risk (a name typed into free-text facts but not declared) can't be caught deterministically.
  app.post("/content/:id/approve", { preHandler: write }, async (req, reply) => {
    const db = scopedDb(req.auth!.organizationId);
    const asset = await db.contentAssets.findById((req.params as { id: string }).id);
    if (!asset) return reply.status(404).send({ error: "not_found", message: "Asset not found." });
    if (asset.status !== "draft") return reply.status(409).send({ error: "invalid_state", message: `Asset is already ${asset.status}.` });
    const expected = z.object({ revision: z.number().int().positive() }).optional().safeParse(req.body);
    if (!expected.success) return reply.status(400).send({ error: "invalid_input", message: "Invalid revision." });
    const result = await db.contentAssets.transition(asset.id, expected.data?.revision ?? asset.revision, ["draft"], "approved");
    return result ?? reply.status(409).send({ error: "stale_revision", message: "Draft changed; review the latest version." });
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
    const result = await db.contentAssets.transition(asset.id, asset.revision, ["approved", "exported"], "exported");
    if (!result) return reply.status(409).send({ error: "stale_revision", message: "Draft changed; review it again before exporting." });
    return { id: asset.id, status: "exported", title: asset.title, body: asset.body };
  });
}

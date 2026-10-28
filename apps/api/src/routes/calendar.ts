import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { scopedDb } from "@sector/db";
import { authenticate, requireRole } from "../auth/middleware.js";
import { requireFeature } from "../auth/plan.js";
import { missingConsent, type AssetKind } from "../content/consent.js";

const fields = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => { const d = new Date(s + "T00:00:00Z"); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; }),
  channel: z.enum(["facebook", "instagram", "email", "website", "linkedin"]),
  objective: z.string().trim().min(3).max(300), assignee: z.string().trim().min(1).max(120),
});
export async function registerCalendarRoutes(app: FastifyInstance): Promise<void> {
  const read = [authenticate, requireFeature("content")];
  const write = [authenticate, requireRole(["owner", "staff"]), requireFeature("content")];
  app.get("/calendar", { preHandler: read }, async (req) => {
    const db = scopedDb(req.auth!.organizationId), active = await db.consentRecords.listActive();
    return (await db.calendar.list()).map(({ item, asset }) => ({ ...item, title: asset.title, revision: asset.revision,
      status: asset.status === "draft" ? "draft" : missingConsent(asset.beneficiaryRefs, asset.kind as AssetKind, active).length ? "consent_required" : "ready_to_post" }));
  });
  app.post("/calendar", { preHandler: write }, async (req, reply) => {
    const p = fields.extend({ contentAssetId: z.string().min(1) }).safeParse(req.body);
    if (!p.success) return reply.status(400).send({ error: "invalid_input", message: "Provide a valid date, channel, objective, responsible person, and draft." });
    const db = scopedDb(req.auth!.organizationId);
    if (!await db.contentAssets.findById(p.data.contentAssetId)) return reply.status(404).send({ error: "not_found", message: "Draft not found." });
    return reply.status(201).send(await db.calendar.create(p.data));
  });
  app.patch("/calendar/:id", { preHandler: write }, async (req, reply) => {
    const p = fields.safeParse(req.body);
    if (!p.success) return reply.status(400).send({ error: "invalid_input", message: "Provide a valid date, channel, objective, and responsible person." });
    return await scopedDb(req.auth!.organizationId).calendar.update((req.params as { id: string }).id, p.data) ?? reply.status(404).send({ error: "not_found", message: "Calendar item not found." });
  });
  app.delete("/calendar/:id", { preHandler: write }, async (req, reply) => {
    const row = await scopedDb(req.auth!.organizationId).calendar.remove((req.params as { id: string }).id);
    return row ? reply.status(204).send() : reply.status(404).send({ error: "not_found", message: "Calendar item not found." });
  });
}

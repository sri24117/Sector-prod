import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { scopedDb } from "@sector/db";
import { assertFcraConfirmed, runComplianceCheck, FcraNotConfirmedError, NoAdGrantAccountError, GatewayUnavailableError, unavailableGateway, type GoogleAdsGateway } from "@sector/ad-grants";
import { authenticate, requireRole, logSecurityEvent } from "../auth/middleware.js";

// Slice 4. EVERY handler runs the FCRA gate first (security.md "FCRA gate"): confirmed by internal ops,
// never inferred from the org's own self-declaration. The denial message is deliberately neutral —
// no teasing a benefit the org can't access.
export async function registerAdGrantsRoutes(app: FastifyInstance, gateway: GoogleAdsGateway = unavailableGateway): Promise<void> {
  const fcraGate = async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
    try { await assertFcraConfirmed(request.auth!.organizationId); }
    catch (err) {
      if (err instanceof FcraNotConfirmedError) {
        await logSecurityEvent({ organizationId: request.auth!.organizationId, userId: request.auth!.userId, action: "ad_grants_fcra_gate_denied", result: "denied" });
        return reply.status(403).send({ error: "not_available", message: "Ad Grants tools are not available for this organization." });
      }
      throw err;
    }
  };
  const read = [authenticate, fcraGate];
  const write = [authenticate, requireRole(["owner", "staff"]), fcraGate];

  app.post("/ad-grants/account", { preHandler: [authenticate, requireRole(["owner"]), fcraGate] }, async (request, reply) => {
    const parsed = z.object({ googleCustomerId: z.string().regex(/^\d{3}-?\d{3}-?\d{4}$/, "Expected a 10-digit Google Ads customer ID") }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_input", message: parsed.error.issues[0]!.message });
    const account = await scopedDb(request.auth!.organizationId).adGrantAccount.upsert(parsed.data.googleCustomerId.replace(/-/g, ""));
    return reply.status(201).send({
      status: account.status, googleCustomerId: account.googleCustomerId,
      nextSteps: [
        `In Google Ads, accept the manager-account link request${process.env.SECTOR_MCC_ID ? ` from ${process.env.SECTOR_MCC_ID}` : ""}.`,
        "Once linked, SEctOr will monitor compliance read-only and alert you — it never changes your campaigns.",
      ],
    });
  });

  app.post("/ad-grants/compliance/run", { preHandler: write, config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (request, reply) => {
    try {
      const { alertCount } = await runComplianceCheck(request.auth!.organizationId, gateway);
      return { alertCount, alerts: await scopedDb(request.auth!.organizationId).complianceAlerts.listOpen() };
    } catch (err) {
      if (err instanceof NoAdGrantAccountError) return reply.status(409).send({ error: "no_account", message: "Link your Google Ads account first." });
      if (err instanceof GatewayUnavailableError) return reply.status(501).send({ error: "not_yet_available", message: "Live compliance checks are not enabled yet." });
      if (err instanceof FcraNotConfirmedError) return reply.status(403).send({ error: "not_available", message: "Ad Grants tools are not available for this organization." });
      throw err;
    }
  });

  app.get("/ad-grants/alerts", { preHandler: read }, async (request) => scopedDb(request.auth!.organizationId).complianceAlerts.listOpen());
}

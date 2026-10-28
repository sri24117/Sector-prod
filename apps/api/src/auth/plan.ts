import type { FastifyReply, FastifyRequest } from "fastify";
import { scopedDb } from "@sector/db";
import { hasFeature, planRequiredMessage, type Feature } from "@sector/shared/plans";

// Plan gating is an extra layer on top of authenticate/requireRole and the tenant scope: it runs
// before the feature's own code and reads the plan of the caller's own organization only.
// Tiers: packages/shared/src/plans.ts.

/** Sends 403 plan_required and returns true when the caller's plan does not include `feature`. */
export async function denyUnlessFeature(request: FastifyRequest, reply: FastifyReply, feature: Feature): Promise<boolean> {
  const org = await scopedDb(request.auth!.organizationId).organization.get();
  if (org && hasFeature(org.plan, feature)) return false;
  await reply.status(403).send({ error: "plan_required", message: planRequiredMessage(feature) });
  return true;
}

/** preHandler: must come after `authenticate`. */
export function requireFeature(feature: Feature) {
  return async function requireFeatureHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await denyUnlessFeature(request, reply, feature);
  };
}

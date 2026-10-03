import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { rawDb, schema } from "@sector/db";

// Phase 0-1 Goal #1: measure whether the free audit converts. Anonymous facts
// only (event, audited URL, org once one exists): no IP, email or user agent.
// Raw client: these events sit before or beside tenancy, never read back per org.

export const CLIENT_EVENTS = ["fix_clicked", "connect_cta_clicked"] as const;
export type FunnelEvent = "audit_run" | "signup_from_audit" | (typeof CLIENT_EVENTS)[number];

export async function recordFunnelEvent(e: { event: FunnelEvent; url?: string | null; organizationId?: string | null }): Promise<void> {
  try {
    await rawDb.insert(schema.funnelEvents).values({ event: e.event, url: e.url?.slice(0, 2048) ?? null, organizationId: e.organizationId ?? null });
  } catch {
    // Measurement must never break the request it measures.
  }
}

export async function registerFunnelRoutes(app: FastifyInstance): Promise<void> {
  app.post("/events", { config: { rateLimit: { max: 60, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const parsed = z.object({ event: z.enum(CLIENT_EVENTS), url: z.string().url().max(2048).optional() }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_event", message: "Unknown event." });
    await recordFunnelEvent(parsed.data);
    return reply.status(204).send();
  });
}

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { runAudit } from "@sector/crawler";
import { assessUrl, isSafePublicUrl } from "../lib/ssrf.js";
import { withAuditSlot, BUSY } from "../lib/audit-slots.js";
import { recordFunnelEvent } from "../lib/funnel.js";

// Slice 1 v1 — see docs/plans/feature-spec-slice1-audit-funnel-v1.md.
// Deliberately synchronous, in-process, no persistence: that spec explains
// why (ADR-0002 not yet CONFIRMED, no queue wiring in this increment).
// Do not add a database call or a BullMQ enqueue here without re-reading
// that spec and CLAUDE.md §7 stop conditions first.

const AuditRequestSchema = z.object({
  url: z.string().min(1, "url is required"),
});

const CRAWL_TIMEOUT_MS = 10_000;

export function normalizeUrl(raw: string): string | null {
  const candidates = raw.includes("://") ? [raw] : [`https://${raw}`, `http://${raw}`];
  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function registerAuditRoutes(app: FastifyInstance): Promise<void> {
  // Public and unauthenticated, so it is rate-limited per client and capped by
  // the shared audit slots; the crawl itself is aborted at CRAWL_TIMEOUT_MS.
  app.post("/audit", { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const parsed = AuditRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_url",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      });
    }

    const normalized = normalizeUrl(parsed.data.url.trim());
    if (!normalized) {
      return reply.status(400).send({
        error: "invalid_url",
        message: "Could not parse that as a valid http(s) URL.",
      });
    }

    const verdict = await assessUrl(normalized);
    if (verdict === "unresolvable") {
      return reply.status(400).send({ error: "site_not_found", message: "Could not find a website at that address. Check the spelling and try again." });
    }
    if (verdict !== "ok") {
      return reply.status(400).send({ error: "url_not_allowed", message: "That address can't be audited." });
    }

    try {
      const slot = await withAuditSlot(() => runAudit(normalized, { allowUrl: isSafePublicUrl, signal: AbortSignal.timeout(CRAWL_TIMEOUT_MS) }));
      if (!slot) return reply.status(503).send(BUSY);
      await recordFunnelEvent({ event: "audit_run", url: slot.value.url });
      return reply.status(200).send(slot.value);
    } catch (err) {
      request.log.warn({ err, url: normalized }, "audit crawl failed");
      return reply.status(502).send({
        error: "crawl_failed",
        message:
          "Could not crawl that URL. It may be unreachable, blocking automated " +
          "requests, or took too long to respond.",
      });
    }
  });
}

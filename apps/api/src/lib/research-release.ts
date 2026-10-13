import { and, eq } from "drizzle-orm";
import { rawDb, schema } from "@sector/db";

// The only code that sets released_at (specs/2026-10-13-research-audit-design.md, "Review and release").
// Ops-only: it takes a bare audit id, so it is never reachable from a request handler.
export async function releaseAudit(auditId: string): Promise<"released" | "not_found" | "not_in_review"> {
  const done = await rawDb.update(schema.researchAudits).set({ status: "released", releasedAt: new Date() })
    .where(and(eq(schema.researchAudits.id, auditId), eq(schema.researchAudits.status, "in_review")))
    .returning({ id: schema.researchAudits.id });
  if (done[0]) return "released";
  const exists = await rawDb.select({ id: schema.researchAudits.id }).from(schema.researchAudits).where(eq(schema.researchAudits.id, auditId));
  return exists[0] ? "not_in_review" : "not_found";
}

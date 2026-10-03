import { and, isNotNull, eq } from "drizzle-orm";
import { rawDb, schema } from "@sector/db";
import { runComplianceCheck } from "./run.js";
import type { GoogleAdsGateway } from "./types.js";

// Scheduled entry point (the BullMQ worker calls this daily). This is one of the few legitimate
// cross-tenant reads: a SYSTEM job must enumerate which orgs are eligible. It only selects org IDs
// (FCRA-confirmed AND has a linked account); everything after that is per-org via runComplianceCheck,
// which re-checks the FCRA gate itself (defense in depth) and uses scopedDb.
export async function runAllComplianceChecks(gateway: GoogleAdsGateway): Promise<{ checked: number; failed: { organizationId: string; error: string }[] }> {
  const eligible = await rawDb
    .select({ organizationId: schema.organizationProfiles.organizationId })
    .from(schema.organizationProfiles)
    .innerJoin(schema.adGrantAccounts, eq(schema.adGrantAccounts.organizationId, schema.organizationProfiles.organizationId))
    .where(and(isNotNull(schema.organizationProfiles.fcraConfirmedAt)));

  const failed: { organizationId: string; error: string }[] = [];
  let checked = 0;
  for (const { organizationId } of eligible) {
    try { await runComplianceCheck(organizationId, gateway); checked++; }
    catch (err) { failed.push({ organizationId, error: err instanceof Error ? err.message : String(err) }); } // one org's failure never blocks the others
  }
  return { checked, failed };
}

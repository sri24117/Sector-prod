import { scopedDb } from "@sector/db";
import { evaluateCompliance } from "./evaluate.js";
import type { GoogleAdsGateway } from "./types.js";

export class FcraNotConfirmedError extends Error {
  constructor() { super("FCRA status is not confirmed for this organization."); this.name = "FcraNotConfirmedError"; }
}
export class NoAdGrantAccountError extends Error {
  constructor() { super("No Ad Grants account is linked for this organization."); this.name = "NoAdGrantAccountError"; }
}

// HARD gate (docs/security/security.md "FCRA gate"): called first by EVERY Ad Grants workflow —
// API routes and the scheduled worker alike — not a UI-level hide. Gates on the ops-confirmed
// timestamp, never on the org's own self-declaration.
export async function assertFcraConfirmed(organizationId: string): Promise<void> {
  const profile = await scopedDb(organizationId).organizationProfile.get();
  if (!profile?.fcraConfirmedAt) throw new FcraNotConfirmedError();
}

// Alert-only in Phase 1 (skills/ad-grants.md §7): reads and alerts, never mutates the live account.
export async function runComplianceCheck(organizationId: string, gateway: GoogleAdsGateway): Promise<{ alertCount: number }> {
  await assertFcraConfirmed(organizationId);
  const db = scopedDb(organizationId);
  const account = await db.adGrantAccount.get();
  if (!account) throw new NoAdGrantAccountError();

  const findings = evaluateCompliance(await gateway.fetchSnapshot(account.googleCustomerId));
  // Each run replaces the open set with the fresh evaluation (fixed issues drop off; history of past alerts is retained as resolved).
  await db.complianceAlerts.resolveAllOpenForAccount(account.id);
  await db.complianceAlerts.createMany(findings.map((f) => ({ ...f, accountId: account.id })));
  return { alertCount: findings.length };
}

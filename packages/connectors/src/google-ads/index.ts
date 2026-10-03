import type { Connector, ConnectorHealth } from "../types.js";
import { NotImplementedError } from "../types.js";

// Google Ads / Ad Grants connector. See skills/ad-grants.md for the full
// domain spec (MCC linking model, compliance rules, GAQL fields needed).
// Gate status: docs/integrations/integrations.md.
//
// GUARDRAIL: never call any method here for an organization whose FCRA
// status is not confirmed true. Enforce this at the call site in apps/api,
// not just here — see docs/security/security.md.

export interface GoogleAdsCredentials {
  refreshToken: string;
  loginCustomerId: string; // SEctOr's MCC customer ID
  linkedCustomerId: string; // the client org's Ad Grants account ID
}

export const googleAdsConnector: Connector<GoogleAdsCredentials> = {
  provider: "google-ads",

  async connect(): Promise<void> {
    throw new NotImplementedError("google-ads", "connect");
  },
  async disconnect(): Promise<void> {
    throw new NotImplementedError("google-ads", "disconnect");
  },
  async health(): Promise<ConnectorHealth> {
    return { ok: false, checkedAt: new Date().toISOString(), detail: "not implemented" };
  },
  async fetch(): Promise<unknown> {
    // Real implementation: GoogleAdsService.Search/SearchStream with the
    // GAQL fields listed in skills/ad-grants.md §5.
    throw new NotImplementedError("google-ads", "fetch");
  },
};

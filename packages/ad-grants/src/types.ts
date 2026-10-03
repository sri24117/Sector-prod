// Google Ads data the compliance monitor needs (skills/ad-grants.md §5: the GAQL fields).
// The evaluator depends only on this shape, so it's testable without Google Ads access.
export interface ComplianceSnapshot {
  accountCreatedAt: string; // ISO date
  ctrLast30d: number; // customer-level, 0..1
  ctrPrev30d: number; // the 30 days before that (the "two consecutive months" rule)
  conversionActions: { name: string; category: string; conversionsLast30d: number }[];
  campaigns: { name: string; biddingStrategy: string; adGroupCount: number }[];
  keywords: { text: string; campaign: string; qualityScore: number | null; maxCpcUsd: number | null }[];
  uniqueSitelinkCount: number;
}

export interface ComplianceFinding {
  ruleId: string;
  metric: string;
  metricValue: string;
  threshold: string;
  message: string;
}

export interface GoogleAdsGateway {
  fetchSnapshot(googleCustomerId: string): Promise<ComplianceSnapshot>;
}

export class GatewayUnavailableError extends Error {
  constructor() {
    super("Google Ads API access has not been granted yet (Explorer/Basic application pending — see docs/integrations/integrations.md).");
    this.name = "GatewayUnavailableError";
  }
}

// Production default until API access is granted: fails loudly, never fabricates data.
export const unavailableGateway: GoogleAdsGateway = {
  async fetchSnapshot() { throw new GatewayUnavailableError(); },
};

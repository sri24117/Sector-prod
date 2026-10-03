import type { Connector, ConnectorHealth } from "../types.js";
import { NotImplementedError } from "../types.js";

// LinkedIn Community Management API. HIGHEST-RISK gate in the whole build —
// discretionary Standard Tier approval, 3-4 months, LinkedIn may reject at
// its own discretion. File the application in week one regardless of when
// this connector gets implemented. See docs/integrations/integrations.md
// and docs/decisions/ADR-0004-social-scheduling-path.md (Ayrshare question).

export interface LinkedInCredentials {
  accessToken: string;
  organizationUrn: string;
}

export const linkedinConnector: Connector<LinkedInCredentials> = {
  provider: "linkedin",
  async connect(): Promise<void> {
    throw new NotImplementedError("linkedin", "connect");
  },
  async disconnect(): Promise<void> {
    throw new NotImplementedError("linkedin", "disconnect");
  },
  async health(): Promise<ConnectorHealth> {
    return { ok: false, checkedAt: new Date().toISOString(), detail: "not implemented" };
  },
  async publish(): Promise<unknown> {
    throw new NotImplementedError("linkedin", "publish");
  },
  async schedule(): Promise<unknown> {
    throw new NotImplementedError("linkedin", "schedule");
  },
};

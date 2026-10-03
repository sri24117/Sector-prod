import type { Connector, ConnectorHealth } from "../types.js";
import { NotImplementedError } from "../types.js";

// Instagram + Facebook. Gated behind App Review + Business Verification per
// permission — see docs/integrations/integrations.md. Do not implement
// publish() against production scopes until that review has cleared; build
// and test against a sandbox/test app in the meantime.

export interface MetaCredentials {
  pageAccessToken: string;
  igBusinessAccountId?: string;
}

export const metaConnector: Connector<MetaCredentials> = {
  provider: "meta",
  async connect(): Promise<void> {
    throw new NotImplementedError("meta", "connect");
  },
  async disconnect(): Promise<void> {
    throw new NotImplementedError("meta", "disconnect");
  },
  async health(): Promise<ConnectorHealth> {
    return { ok: false, checkedAt: new Date().toISOString(), detail: "not implemented" };
  },
  async publish(): Promise<unknown> {
    throw new NotImplementedError("meta", "publish");
  },
  async schedule(): Promise<unknown> {
    throw new NotImplementedError("meta", "schedule");
  },
  async analytics(): Promise<unknown> {
    throw new NotImplementedError("meta", "analytics");
  },
};

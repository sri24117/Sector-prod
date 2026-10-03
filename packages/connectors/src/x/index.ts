import type { Connector, ConnectorHealth } from "../types.js";
import { NotImplementedError } from "../types.js";

// X (Twitter). No approval gate, but pay-per-use — every publish() call has
// a real linear cost. Price this into the product; don't treat it as a free
// channel like Meta/LinkedIn organic posting.

export interface XCredentials {
  accessToken: string;
  accessSecret: string;
}

export const xConnector: Connector<XCredentials> = {
  provider: "x",
  async connect(): Promise<void> {
    throw new NotImplementedError("x", "connect");
  },
  async disconnect(): Promise<void> {
    throw new NotImplementedError("x", "disconnect");
  },
  async health(): Promise<ConnectorHealth> {
    return { ok: false, checkedAt: new Date().toISOString(), detail: "not implemented" };
  },
  async publish(): Promise<unknown> {
    throw new NotImplementedError("x", "publish");
  },
};

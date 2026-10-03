import type { Connector, ConnectorHealth } from "../types.js";
import { NotImplementedError } from "../types.js";

export interface GoogleAnalyticsCredentials {
  refreshToken: string;
  propertyId: string;
}

export const googleAnalyticsConnector: Connector<GoogleAnalyticsCredentials> = {
  provider: "google-analytics",
  async connect(): Promise<void> {
    throw new NotImplementedError("google-analytics", "connect");
  },
  async disconnect(): Promise<void> {
    throw new NotImplementedError("google-analytics", "disconnect");
  },
  async health(): Promise<ConnectorHealth> {
    return { ok: false, checkedAt: new Date().toISOString(), detail: "not implemented" };
  },
  async analytics(): Promise<unknown> {
    throw new NotImplementedError("google-analytics", "analytics");
  },
};

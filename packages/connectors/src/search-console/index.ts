import type { Connector, ConnectorHealth } from "../types.js";
import { NotImplementedError } from "../types.js";

export interface SearchConsoleCredentials {
  refreshToken: string;
  siteUrl: string;
}

export const searchConsoleConnector: Connector<SearchConsoleCredentials> = {
  provider: "search-console",
  async connect(): Promise<void> {
    throw new NotImplementedError("search-console", "connect");
  },
  async disconnect(): Promise<void> {
    throw new NotImplementedError("search-console", "disconnect");
  },
  async health(): Promise<ConnectorHealth> {
    return { ok: false, checkedAt: new Date().toISOString(), detail: "not implemented" };
  },
  async fetch(): Promise<unknown> {
    throw new NotImplementedError("search-console", "fetch");
  },
};

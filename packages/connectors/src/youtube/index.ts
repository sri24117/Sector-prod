import type { Connector, ConnectorHealth } from "../types.js";
import { NotImplementedError } from "../types.js";

// YouTube. Sensitive-scope OAuth requires Google trust & safety review.
// Unverified apps are hard-capped at 100 channels regardless of review
// outcome — a real ceiling on growth, not just a launch-timing issue.

export interface YouTubeCredentials {
  refreshToken: string;
  channelId: string;
}

export const youtubeConnector: Connector<YouTubeCredentials> = {
  provider: "youtube",
  async connect(): Promise<void> {
    throw new NotImplementedError("youtube", "connect");
  },
  async disconnect(): Promise<void> {
    throw new NotImplementedError("youtube", "disconnect");
  },
  async health(): Promise<ConnectorHealth> {
    return { ok: false, checkedAt: new Date().toISOString(), detail: "not implemented" };
  },
  async publish(): Promise<unknown> {
    throw new NotImplementedError("youtube", "publish");
  },
  async schedule(): Promise<unknown> {
    throw new NotImplementedError("youtube", "schedule");
  },
  async analytics(): Promise<unknown> {
    throw new NotImplementedError("youtube", "analytics");
  },
};

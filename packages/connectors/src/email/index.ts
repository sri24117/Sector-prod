import type { Connector, ConnectorHealth } from "../types.js";
import { NotImplementedError } from "../types.js";

// Transactional/outreach email. Provider choice (SES / Postmark / Resend)
// is HUMAN DECISION REQUIRED — not yet made. Keep this interface
// provider-agnostic so the choice doesn't leak into application code.

export interface EmailCredentials {
  fromAddress: string;
}

export const emailConnector: Connector<EmailCredentials> = {
  provider: "email",
  async connect(): Promise<void> {
    throw new NotImplementedError("email", "connect");
  },
  async disconnect(): Promise<void> {
    throw new NotImplementedError("email", "disconnect");
  },
  async health(): Promise<ConnectorHealth> {
    return { ok: false, checkedAt: new Date().toISOString(), detail: "not implemented" };
  },
  async publish(): Promise<unknown> {
    // "publish" here means "send" — kept consistent with the shared
    // interface rather than adding a one-off `send()` method.
    throw new NotImplementedError("email", "publish");
  },
};

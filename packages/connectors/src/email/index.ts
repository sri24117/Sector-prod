import { fetch } from "undici";

// Transactional email FROM SEctOr (password reset, account notices) — not an
// organization's outbound marketing, so this connector has no per-organization
// credentials: the API key and the From address belong to SEctOr, not to an NGO.
// That is also why it does not implement the org-scoped Connector interface in
// ../types.ts; it is SEctOr's own notifier, not a customer's channel.
//
// Provider: Resend (founder decision 2026-11-16, recorded in PROJECT.md §4).
// Resend's REST API is one HTTPS POST, so no SDK is added for it.

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const RESEND_DOMAINS_URL = "https://api.resend.com/domains";
const TIMEOUT_MS = 10_000;

export interface EmailCredentials {
  apiKey: string;
  /** Must be on a domain verified in Resend, e.g. "SEctOr <no-reply@sector.org>". */
  fromAddress: string;
  replyTo?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /**
   * Resend returns the first send's result for a repeated key (24h window)
   * instead of sending twice. Pass a key derived from something that identifies
   * THIS send — a password-reset token hash, not the recipient.
   */
  idempotencyKey?: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<{ id: string }>;
  health(): Promise<{ ok: boolean; detail?: string }>;
}

export class EmailError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "EmailError";
  }
}

interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

type ResendRequest = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<HttpResponse>;

export function resendEmail(credentials: EmailCredentials, deps: { request?: ResendRequest } = {}): EmailTransport {
  // Seam for tests: production always uses undici's fetch.
  const request: ResendRequest = deps.request ?? ((url, init) => fetch(url, init));
  const authHeaders = { authorization: `Bearer ${credentials.apiKey}` };

  return {
    async send(message) {
      const res = await request(RESEND_EMAILS_URL, {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          ...(message.idempotencyKey ? { "idempotency-key": message.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: credentials.fromAddress,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          ...(credentials.replyTo ? { reply_to: credentials.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // The response body is deliberately not surfaced: it can echo the request back.
      if (res.status === 401) throw new EmailError("Resend rejected the API key (401).", res.status);
      if (res.status === 429) throw new EmailError("Resend rate limit reached (429).", res.status);
      if (!res.ok) throw new EmailError(`Resend refused the email (${res.status}).`, res.status);
      const body = (await res.json()) as { id?: string };
      if (!body.id) throw new EmailError("Resend accepted the email but returned no id.");
      return { id: body.id };
    },

    async health() {
      try {
        const res = await request(RESEND_DOMAINS_URL, {
          method: "GET",
          headers: authHeaders,
          body: "",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) return { ok: false, detail: `Resend answered ${res.status} for the domain list (key or domain not verified?).` };
        const body = (await res.json()) as { data?: { name?: string; status?: string }[] };
        const unverified = (body.data ?? []).filter((d) => d.status !== "verified");
        return unverified.length === 0
          ? { ok: true, detail: `${(body.data ?? []).length} sending domain(s) verified` }
          : { ok: false, detail: `Domain not verified: ${unverified.map((d) => d.name ?? "?").join(", ")}` };
      } catch (err) {
        return { ok: false, detail: err instanceof Error ? err.message : "request failed" };
      }
    },
  };
}
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { pool, rawDb, schema } from "@sector/db";
import { resendEmail, EmailError } from "@sector/connectors";
import { buildApp } from "../src/app.js";
import { emailTransportFromEnv, passwordResetLink, sendPasswordResetEmail } from "../src/lib/email.js";

// Resend is SEctOr's own transactional mail (password reset). No API key is set in
// tests, so these cover the config gate and the request the adapter would make —
// never a real send.

const CREDENTIALS = { apiKey: "re_test_key", fromAddress: "SEctOr <no-reply@sector.org>" };

type Call = { url: string; init: { method: string; headers: Record<string, string>; body: string } };

function transportReturning(id: string | null = "email-1", status = 200) {
  const calls: Call[] = [];
  return {
    calls,
    transport: resendEmail(CREDENTIALS, {
      request: async (url, init) => {
        calls.push({ url, init });
        return { ok: status >= 200 && status < 300, status, json: async () => (id ? { id } : {}) };
      },
    }),
  };
}

describe("email config gate", () => {
  it("returns null unless both RESEND_API_KEY and EMAIL_FROM are set", () => {
    expect(emailTransportFromEnv({})).toBeNull();
    expect(emailTransportFromEnv({ RESEND_API_KEY: "re_x" })).toBeNull();
    expect(emailTransportFromEnv({ EMAIL_FROM: "SEctOr <no-reply@sector.org>" })).toBeNull();
    expect(emailTransportFromEnv({ RESEND_API_KEY: "re_x", EMAIL_FROM: "  " })).toBeNull();
  });

  it("returns a transport when both are set", () => {
    expect(emailTransportFromEnv({ RESEND_API_KEY: "re_x", EMAIL_FROM: "SEctOr <no-reply@sector.org>" })).not.toBeNull();
  });

  it("sendPasswordResetEmail reports false when no provider is configured, without sending", async () => {
    await expect(sendPasswordResetEmail({ to: "a@b.org", name: "A", token: "t" })).resolves.toBe(false);
  });
});

describe("password reset link", () => {
  it("is built from APP_URL and encodes the token", () => {
    expect(passwordResetLink("abc+/=", "https://app.sector.org")).toBe("https://app.sector.org/reset-password?token=abc%2B%2F%3D");
  });

  it("does not double the slash when APP_URL has a trailing one", () => {
    expect(passwordResetLink("t", "https://app.sector.org/")).toBe("https://app.sector.org/reset-password?token=t");
  });
});

describe("Resend adapter", () => {
  it("posts one email with bearer auth, the from address and the idempotency key", async () => {
    const { transport, calls } = transportReturning("email-42");
    const result = await transport.send({
      to: "user@hope.org",
      subject: "Reset your SEctOr password",
      text: "hello",
      idempotencyKey: "password-reset:deadbeef",
    });

    expect(result).toEqual({ id: "email-42" });
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe("https://api.resend.com/emails");
    expect(call.init.method).toBe("POST");
    expect(call.init.headers.authorization).toBe("Bearer re_test_key");
    expect(call.init.headers["content-type"]).toBe("application/json");
    expect(call.init.headers["idempotency-key"]).toBe("password-reset:deadbeef");
    expect(JSON.parse(call.init.body)).toEqual({
      from: CREDENTIALS.fromAddress,
      to: ["user@hope.org"],
      subject: "Reset your SEctOr password",
      text: "hello",
    });
  });

  it("adds reply_to and html only when they are supplied", async () => {
    const { transport, calls } = transportReturning();
    await transport.send({ to: "user@hope.org", subject: "s", text: "t", html: "<p>t</p>" });
    expect(JSON.parse(calls[0]!.init.body)).not.toHaveProperty("reply_to");
    expect(JSON.parse(calls[0]!.init.body)).toHaveProperty("html", "<p>t</p>");

    const withReply = resendEmail({ ...CREDENTIALS, replyTo: "support@sector.org" }, {
      request: async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ id: "x" }) }; },
    });
    await withReply.send({ to: "user@hope.org", subject: "s", text: "t" });
    expect(JSON.parse(calls[1]!.init.body)).toHaveProperty("reply_to", "support@sector.org");
  });

  it("throws EmailError on a provider refusal without echoing the response body", async () => {
    const { transport } = transportReturning(null, 401);
    await expect(transport.send({ to: "user@hope.org", subject: "s", text: "t" })).rejects.toBeInstanceOf(EmailError);
  });

  it("throws EmailError when the provider accepts but returns no id", async () => {
    const { transport } = transportReturning(null, 200);
    await expect(transport.send({ to: "user@hope.org", subject: "s", text: "t" })).rejects.toThrow(/no id/);
  });
});

// The request route must answer 202 and record why nothing was sent when Resend is
// not configured — a missing key is an ops problem, never a 500 to the user.
describe("password reset request without a mail provider", () => {
  const EMAIL = "noresend@hope.org";
  const priorKey = process.env.RESEND_API_KEY;
  const priorFrom = process.env.EMAIL_FROM;
  let app: FastifyInstance;

  beforeAll(async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    app = await buildApp();
    await app.ready();
    const res = await app.inject({ method: "POST", url: "/auth/signup", payload: { acceptTerms: true, organizationName: "No Resend NGO", name: "N", email: EMAIL, password: "original-password-1" } });
    expect(res.statusCode).toBe(201);
  });

  afterAll(async () => {
    if (priorKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = priorKey;
    if (priorFrom === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = priorFrom;
    await pool.query("TRUNCATE organizations, users, memberships, organization_profiles, sessions, security_event_log, password_reset_tokens, funnel_events CASCADE");
    await app.close();
    await pool.end();
  });

  it("still answers 202, stores a single-use token, and logs that no email was sent", async () => {
    const res = await app.inject({ method: "POST", url: "/auth/password-reset/request", payload: { email: EMAIL } });
    expect(res.statusCode).toBe(202);

    const userId = res.json().userId as string | undefined;
    const tokens = await rawDb.select().from(schema.passwordResetTokens);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.usedAt).toBeNull();
    expect(userId).toBeUndefined(); // the account is not revealed by the response

    const [event] = await rawDb.select().from(schema.securityEventLog).where(eq(schema.securityEventLog.action, "password_reset_requested"));
    expect(event?.detail).toBe("email_not_configured");
  });
});
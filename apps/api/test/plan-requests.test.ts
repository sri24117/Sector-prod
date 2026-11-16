import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { pool, rawDb, schema } from "@sector/db";
import { buildApp } from "../src/app.js";

describe("plan requests", () => {
  const priorKey = process.env.RESEND_API_KEY;
  const priorFrom = process.env.EMAIL_FROM;
  const priorNotify = process.env.PLAN_REQUEST_NOTIFY_TO;
  let app: FastifyInstance;

  beforeAll(async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.PLAN_REQUEST_NOTIFY_TO;
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (priorKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = priorKey;
    if (priorFrom === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = priorFrom;
    if (priorNotify === undefined) delete process.env.PLAN_REQUEST_NOTIFY_TO; else process.env.PLAN_REQUEST_NOTIFY_TO = priorNotify;
    await pool.query("TRUNCATE plan_requests, security_event_log CASCADE");
    await app.close();
    await pool.end();
  });

  it("persists a normalized Starter invoice request before acknowledging it", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/plan-requests",
      remoteAddress: "198.51.100.21",
      payload: {
        organizationName: "  Hope Foundation  ",
        contactName: "  Asha Rao  ",
        email: "ASHA@HOPE.ORG",
        plan: "starter",
        billingCycle: "annual",
        notes: "  Please call after 3 PM.  ",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().message).toContain("Nothing has been charged");
    const [saved] = await rawDb.select().from(schema.planRequests).where(eq(schema.planRequests.email, "asha@hope.org"));
    expect(saved).toMatchObject({
      organizationName: "Hope Foundation",
      contactName: "Asha Rao",
      email: "asha@hope.org",
      plan: "starter",
      billingCycle: "annual",
      notes: "Please call after 3 PM.",
      status: "requested",
    });

    const [event] = await rawDb.select().from(schema.securityEventLog).where(eq(schema.securityEventLog.action, "plan_request_created"));
    expect(event?.detail).toContain("delivery=email_not_configured");
  });

  it("rejects Free, malformed contact data and unexpected fields", async () => {
    for (const [index, payload] of [
      { organizationName: "H", contactName: "A", email: "bad", plan: "starter", billingCycle: "monthly" },
      { organizationName: "Hope", contactName: "A", email: "a@hope.org", plan: "free", billingCycle: "monthly" },
      { organizationName: "Hope", contactName: "A", email: "a@hope.org", plan: "starter", billingCycle: "weekly" },
      { organizationName: "Hope", contactName: "A", email: "a@hope.org", plan: "starter", billingCycle: "monthly", paid: true },
    ].entries()) {
      const response = await app.inject({ method: "POST", url: "/plan-requests", remoteAddress: `198.51.100.${30 + index}`, payload });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe("invalid_input");
    }
  });
});

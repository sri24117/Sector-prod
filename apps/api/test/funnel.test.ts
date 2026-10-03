import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { pool, rawDb, schema } from "@sector/db";

// Goal #1 instrumentation: the free audit funnel records audit runs, clicks on
// the fix/connect calls to action, and signups that came from an audit.
vi.mock("@sector/crawler", () => ({ runAudit: vi.fn() }));
const { runAudit } = await import("@sector/crawler");
const { buildApp } = await import("../src/app.js");

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => {
  await pool.query("TRUNCATE organizations, users, memberships, organization_profiles, sessions, security_event_log, funnel_events CASCADE");
  await app.close(); await pool.end();
});

const events = (event: string) => rawDb.select().from(schema.funnelEvents).where(eq(schema.funnelEvents.event, event));

describe("funnel events", () => {
  it("a successful free audit records audit_run with the audited URL", async () => {
    vi.mocked(runAudit).mockResolvedValueOnce({ url: "https://hope-ngo.org/", score: 40, runAt: new Date().toISOString(), checks: [] });
    const res = await app.inject({ method: "POST", url: "/audit", payload: { url: "hope-ngo.org" } });
    expect(res.statusCode).toBe(200);
    const rows = await events("audit_run");
    expect(rows.map((r) => r.url)).toContain("https://hope-ngo.org/");
  });

  it("records an allowed client event and rejects anything else", async () => {
    const ok = await app.inject({ method: "POST", url: "/events", payload: { event: "fix_clicked", url: "https://hope-ngo.org/" } });
    expect(ok.statusCode).toBe(204);
    expect(await events("fix_clicked")).toHaveLength(1);
    const bad = await app.inject({ method: "POST", url: "/events", payload: { event: "drop_tables" } });
    expect(bad.statusCode).toBe(400);
  });

  it("a signup that came from an audit is recorded against the new org", async () => {
    const res = await app.inject({ method: "POST", url: "/auth/signup", payload: {
      organizationName: "Hope NGO", name: "H", email: "h@hope-ngo.org", password: "long-enough-password", websiteUrl: "https://hope-ngo.org/", fromAudit: true,
    } });
    expect(res.statusCode).toBe(201);
    const rows = await events("signup_from_audit");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.organizationId).toBe(res.json().organizationId);
    expect(rows[0]!.url).toBe("https://hope-ngo.org/");
  });

  it("a signup without an audit records nothing", async () => {
    await app.inject({ method: "POST", url: "/auth/signup", payload: { organizationName: "Other", name: "O", email: "o@other.org", password: "long-enough-password" } });
    expect(await events("signup_from_audit")).toHaveLength(1);
  });
});

import { describe, it, expect, afterEach, afterAll, vi } from "vitest";
import { pool } from "@sector/db";
import { buildApp } from "../src/app.js";

// The create route must not exist in production until the owner switches research audits on.
afterEach(() => { vi.unstubAllEnvs(); });

async function postStatus(): Promise<number> {
  const app = await buildApp({ reportQueue: { add: async () => {} } });
  try { await app.ready(); return (await app.inject({ method: "POST", url: "/research-audits" })).statusCode; }
  finally { await app.close(); }
}

describe("RESEARCH_AUDIT_ENABLED", () => {
  it("leaves POST /research-audits unregistered when the flag is off or missing", async () => {
    vi.stubEnv("RESEARCH_AUDIT_ENABLED", "");
    expect(await postStatus()).toBe(404);
    vi.stubEnv("RESEARCH_AUDIT_ENABLED", "false");
    expect(await postStatus()).toBe(404);
  });

  it("registers the route when the flag is exactly true (an unauthenticated call is then refused with 401)", async () => {
    vi.stubEnv("RESEARCH_AUDIT_ENABLED", "true");
    expect(await postStatus()).toBe(401);
  });

  it("keeps the read routes available either way", async () => {
    vi.stubEnv("RESEARCH_AUDIT_ENABLED", "false");
    const app = await buildApp({ reportQueue: { add: async () => {} } });
    await app.ready();
    expect((await app.inject({ method: "GET", url: "/research-audits" })).statusCode).toBe(401);
    await app.close();
  });
});

afterAll(async () => { await pool.end(); });

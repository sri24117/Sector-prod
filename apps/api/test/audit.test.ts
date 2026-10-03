import { describe, it, expect, vi, afterEach } from "vitest";
import Fastify from "fastify";
import { registerAuditRoutes } from "../src/routes/audit.js";

vi.mock("@sector/crawler", () => ({
  runAudit: vi.fn(),
}));

const { runAudit } = await import("@sector/crawler");

function buildApp() {
  const app = Fastify();
  return registerAuditRoutes(app).then(() => app);
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("POST /audit", () => {
  it("returns the audit result for a valid, reachable URL (happy path)", async () => {
    const fakeResult = {
      url: "https://example-ngo.org/",
      score: 65,
      runAt: "2026-09-25T00:00:00.000Z",
      checks: [{ checkId: "schema", weight: 20, passed: true, detail: "ok" }],
    };
    vi.mocked(runAudit).mockResolvedValueOnce(fakeResult);

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/audit",
      payload: { url: "example-ngo.org" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(fakeResult);
    expect(runAudit).toHaveBeenCalledWith("https://example-ngo.org/");
  });

  it("returns 400 for an empty/invalid URL and never calls the crawler", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/audit",
      payload: { url: "" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_url");
    expect(runAudit).not.toHaveBeenCalled();
  });

  it("returns 502 with a plain-language message when the crawl fails (failure path)", async () => {
    vi.mocked(runAudit).mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/audit",
      payload: { url: "https://unreachable.example" },
    });

    expect(res.statusCode).toBe(502);
    const body = res.json();
    expect(body.error).toBe("crawl_failed");
    // Must not leak the raw error/stack to the client.
    expect(body.message).not.toContain("ECONNREFUSED");
  });
});

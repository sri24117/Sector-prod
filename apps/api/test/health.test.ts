import { describe, it, expect, afterAll, vi } from "vitest";
import { pool } from "@sector/db";
import { buildApp } from "../src/app.js";

// Uptime monitors watch /health, so it must fail when the database does,
// not just when the process is gone.
afterAll(async () => { await pool.end(); });

describe("GET /health", () => {
  it("is ok when the database answers", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", database: "ok" });
    await app.close();
  });

  it("returns 503 when the database is unreachable", async () => {
    const spy = vi.spyOn(pool, "query").mockRejectedValueOnce(new Error("ECONNREFUSED") as never);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: "degraded", database: "unreachable" });
    expect(JSON.stringify(res.json())).not.toContain("ECONNREFUSED");
    spy.mockRestore();
    await app.close();
  });
});

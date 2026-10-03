import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { pool } from "@sector/db";
import { buildApp } from "../src/app.js";

// Unhandled errors must never reach the client verbatim: a misconfigured
// DATABASE_URL once made POST /auth/login answer 500 with Postgres's own
// "no PostgreSQL user name specified in startup packet". Uses buildApp so
// this covers the exact production wiring.

const INTERNAL_DETAIL = "no PostgreSQL user name specified in startup packet";
let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  app.get("/__test/boom", async () => {
    throw new Error(INTERNAL_DETAIL);
  });
  app.get("/__test/bad-request", async () => {
    throw Object.assign(new Error("Widget id must be a UUID."), { statusCode: 400 });
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("global error handler", () => {
  it("returns a generic body for unhandled 5xx errors", async () => {
    const res = await app.inject({ method: "GET", url: "/__test/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "server_error", message: "Something went wrong. Please try again." });
    expect(res.body).not.toContain("PostgreSQL");
  });

  it("does not leak a Postgres error code either", async () => {
    const res = await app.inject({ method: "GET", url: "/__test/boom" });
    expect(Object.keys(res.json())).toEqual(["error", "message"]);
  });

  it("keeps the message for deliberate 4xx errors", async () => {
    const res = await app.inject({ method: "GET", url: "/__test/bad-request" });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe("Widget id must be a UUID.");
  });

  it("still returns JSON 404 for unknown routes", async () => {
    const res = await app.inject({ method: "GET", url: "/__test/does-not-exist" });
    expect(res.statusCode).toBe(404);
  });
});

import { describe, it, expect, afterEach } from "vitest";
import { buildApp } from "../src/app.js";

// Behind Caddy every request arrives from the proxy's IP. Without trusting
// X-Forwarded-For, the per-IP login/signup rate limits become one global
// bucket shared by every NGO. TRUST_PROXY opts in; default stays off so a
// directly exposed API can't have its limits bypassed with a spoofed header.

const badLogin = (ip: string) => ({ method: "POST" as const, url: "/auth/login", payload: {}, headers: { "x-forwarded-for": ip } });

async function exhaust(app: Awaited<ReturnType<typeof buildApp>>, ip: string) {
  for (let i = 0; i < 10; i++) await app.inject(badLogin(ip));
  return (await app.inject(badLogin(ip))).statusCode;
}

afterEach(() => { delete process.env.TRUST_PROXY; });

describe("TRUST_PROXY", () => {
  it("when set, rate-limits each forwarded client separately", async () => {
    process.env.TRUST_PROXY = "127.0.0.1";
    const app = await buildApp();
    expect(await exhaust(app, "203.0.113.1")).toBe(429);
    expect((await app.inject(badLogin("203.0.113.2"))).statusCode).toBe(400);
    await app.close();
  });

  it("when unset, ignores X-Forwarded-For (a spoofed header can't dodge the limit)", async () => {
    const app = await buildApp();
    expect(await exhaust(app, "203.0.113.1")).toBe(429);
    expect((await app.inject(badLogin("203.0.113.2"))).statusCode).toBe(429);
    await app.close();
  });
});

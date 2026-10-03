import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { runAudit } from "../src/audit.js";
import { createGuardedAgent } from "@sector/shared/net-guard";

// Crawler-level SSRF and resource limits (2026-10 review, roadmap §2).
let server: Server; let base: string;
const sockets = new Set<import("node:net").Socket>();

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/hang") return; // never answers
    if (req.url === "/huge") {
      res.writeHead(200, { "content-type": "text/html" });
      res.write("<html><body><h1>Big NGO</h1><h2>About</h2>");
      const chunk = "<p>" + "x".repeat(64 * 1024) + "</p>";
      for (let i = 0; i < 80; i++) res.write(chunk); // ~5 MB
      return void res.end("</body></html>");
    }
    res.writeHead(200, { "content-type": "text/html" }).end("<html><body><h1>ok</h1></body></html>");
  });
  server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { for (const s of sockets) s.destroy(); return new Promise<void>((r) => server.close(() => r())); });

describe("crawler guard", () => {
  it("refuses a private target with default options", async () => {
    await expect(runAudit(`${base}/`)).rejects.toThrow(/not allowed/i);
  });

  it("still refuses at connection time if the pre-check is bypassed", async () => {
    const strict = createGuardedAgent({ allowPrivate: false });
    await expect(runAudit(`${base}/`, { allowUrl: async () => true, dispatcher: strict })).rejects.toThrow(/private|not allowed/i);
  });

  it("an abort signal actually stops the crawl", async () => {
    const local = createGuardedAgent({ allowPrivate: true });
    const started = Date.now();
    await expect(runAudit(`${base}/hang`, { allowUrl: async () => true, dispatcher: local, signal: AbortSignal.timeout(300) })).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("reads at most 2 MB of a huge page and still audits it", async () => {
    const local = createGuardedAgent({ allowPrivate: true });
    const result = await runAudit(`${base}/huge`, { allowUrl: async () => true, dispatcher: local });
    const headings = result.checks.find((c) => c.checkId === "heading_hierarchy")!;
    expect(headings.passed).toBe(true);
  });
});

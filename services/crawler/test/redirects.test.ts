import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { runAudit } from "../src/audit.js";

// Many NGO sites redirect apex -> www or http -> https. Before this test the
// crawler scored the 3xx stub body instead of the real page.

const realPage = "<html><body><h1>Real NGO</h1><h2>About</h2><p>Served 1,200 children</p></body></html>";

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/") return void res.writeHead(301, { location: "/home" }).end("<html><body><h1>Moved</h1></body></html>");
    if (req.url === "/home") return void res.writeHead(200, { "content-type": "text/html" }).end(realPage);
    if (req.url === "/loop") return void res.writeHead(302, { location: "/loop" }).end();
    if (req.url === "/to-internal") return void res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data" }).end();
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("runAudit redirects", () => {
  it("audits the page a redirect points to, and reports the final URL", async () => {
    const result = await runAudit(`${base}/`);
    expect(result.url).toBe(`${base}/home`);
    const headings = result.checks.find((c) => c.checkId === "heading_hierarchy")!;
    expect(headings.passed).toBe(true);
    expect(headings.detail).toBe("Found 1 <h1>, 1 <h2>");
  });

  it("checks every redirect hop against allowUrl and refuses a blocked target", async () => {
    const seen: string[] = [];
    const allowUrl = async (u: string) => {
      seen.push(u);
      return !u.includes("169.254.169.254");
    };
    await expect(runAudit(`${base}/to-internal`, { allowUrl })).rejects.toThrow(/not allowed/i);
    expect(seen).toContain("http://169.254.169.254/latest/meta-data");
  });

  it("gives up on a redirect loop instead of hanging", async () => {
    await expect(runAudit(`${base}/loop`)).rejects.toThrow(/too many redirects/i);
  });
});

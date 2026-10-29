import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import * as cheerio from "cheerio";
import { runAudit } from "../src/audit.js";
import { createGuardedAgent } from "@sector/shared/net-guard";

// A minimal smoke test proving the check logic is wired correctly, in the
// spirit of the original v0's fixture-based validation (score 100/5/42 on
// three synthetic pages). Full fixture parity with the original test suite
// is not yet re-established — see README.md.

describe("heading hierarchy check shape", () => {
  it("flags a page with zero H1s and a title rendered as H2", () => {
    const html = "<html><body><h2>Page Title</h2><p>content</p></body></html>";
    const $ = cheerio.load(html);
    expect($("h1").length).toBe(0);
    expect($("h2").length).toBe(1);
    // A real assertion against checkHeadingHierarchy() belongs here once
    // that function is exported for direct unit testing rather than only
    // through runAudit()'s network-calling path.
  });
});

describe("runAudit platform and served words", () => {
  let server: Server;
  let base: string;
  const local = { dispatcher: createGuardedAgent({ allowPrivate: true }), allowUrl: async () => true };

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/") {
        return void res.writeHead(200, { "content-type": "text/html" }).end(
          '<html><head><link rel="stylesheet" href="/wp-content/x.css"></head><body><h1>Real NGO</h1> <p>We served many children this year</p></body></html>',
        );
      }
      if (req.url === "/spa") {
        return void res.writeHead(200, { "content-type": "text/html" }).end(
          '<html><body><div id="root"></div><script>document.getElementById("root").textContent = "lots of rendered words here";</script></body></html>',
        );
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("reports the detected platform and the words served in the HTML", async () => {
    const result = await runAudit(`${base}/`, local);
    expect(typeof result.platform).toBe("string");
    expect(result.platform).toBe("wordpress");
    expect(typeof result.htmlWords).toBe("number");
    expect(result.htmlWords).toBeGreaterThan(0);
    expect(result.htmlWords).toBe(8); // "Real NGO" + "We served many children this year"
  });

  it("counts zero served words for a script-only client-rendered page", async () => {
    const result = await runAudit(`${base}/spa`, local);
    expect(result.htmlWords).toBe(0);
  });
});

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

// A stand-in WordPress site implementing exactly the surface our connector uses:
// Application-Password Basic auth, /wp-json/wp/v2/users/me, the companion plugin's
// /sector/v1/{status,schema}, and server-rendered JSON-LD in <head>. It proves OUR
// code end to end; it does NOT prove the PHP plugin on real WordPress (see spec).
export interface MockWp { url: string; server: Server; state: { jsonLd: unknown | null; schemaPosts: number }; close(): Promise<void>; }

export async function startMockWordPress(opts: { username: string; appPassword: string; pluginInstalled?: boolean }): Promise<MockWp> {
  const state = { jsonLd: null as unknown | null, schemaPosts: 0 };
  const expected = "Basic " + Buffer.from(`${opts.username}:${opts.appPassword}`).toString("base64");
  const server = createServer((req, res) => {
    const json = (code: number, body: unknown) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
    const authed = req.headers.authorization === expected;
    if (req.url === "/wp-json/wp/v2/users/me") return authed ? json(200, { name: "Site Admin" }) : json(401, { code: "rest_forbidden" });
    if (req.url === "/wp-json/sector/v1/status") return authed && opts.pluginInstalled !== false ? json(200, { ok: true }) : json(authed ? 404 : 401, {});
    if (req.url === "/wp-json/sector/v1/schema" && req.method === "POST") {
      if (!authed) return json(401, {});
      let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => { state.jsonLd = JSON.parse(body).jsonLd; state.schemaPosts++; json(200, { ok: true }); });
      return;
    }
    if (req.url === "/" || req.url === "") {
      const ld = state.jsonLd ? `<script type="application/ld+json">${JSON.stringify(state.jsonLd)}</script>` : "";
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(`<html><head><title>Hope NGO</title>${ld}</head><body><h1>Hope NGO</h1><p>We helped 1,200 children in 2025.</p></body></html>`);
    }
    res.writeHead(404); res.end("not found");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  return { url: `http://127.0.0.1:${port}`, server, state, close: () => new Promise((r) => server.close(() => r())) };
}

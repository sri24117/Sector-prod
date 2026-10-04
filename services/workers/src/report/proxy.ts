import { createServer, request as httpRequest, type IncomingMessage } from "node:http";
import { connect, isIP, type Socket } from "node:net";
import { lookup } from "node:dns/promises";
import type { AddressInfo } from "node:net";
import { isPrivateAddress } from "@sector/shared/net-guard";

// The browser's only route to the internet during a full report (ADR-0007).
// Chromium resolves DNS itself, so the undici guard cannot protect it; instead
// Chromium (and Lighthouse's Chromium) are started with --proxy-server pointing
// here, and this proxy resolves every host, refuses private/internal answers,
// and connects to the exact address it checked.

type Resolver = (host: string) => Promise<{ address: string; family: number }[]>;
export interface GuardedProxy { port: number; url: string; close(): Promise<void> }

const WEB_PORTS = [80, 443, 8080, 8443];

export async function startGuardedProxy(opts: { allowPrivate?: boolean; resolve?: Resolver; allowPorts?: number[] } = {}): Promise<GuardedProxy> {
  const allowPrivate = opts.allowPrivate ?? process.env.ALLOW_PRIVATE_TARGETS === "1";
  const resolve: Resolver = opts.resolve ?? ((h) => lookup(h, { all: true, verbatim: true }));
  const ports = new Set([...WEB_PORTS, ...(opts.allowPorts ?? [])]);

  /** The address to dial, or null when the target must be refused. */
  async function pick(host: string, port: number): Promise<{ address: string; family: number } | null> {
    if (!ports.has(port)) return null;
    const bare = host.replace(/^\[|\]$/g, "");
    const addrs = isIP(bare) ? [{ address: bare, family: isIP(bare) }] : await resolve(bare).catch(() => []);
    if (!addrs.length) return null;
    if (!allowPrivate && addrs.some((a) => isPrivateAddress(a.address))) return null;
    return addrs[0]!;
  }

  const server = createServer(async (req, res) => {
    // Plain-HTTP proxying: the request line carries an absolute URL.
    let url: URL;
    try { url = new URL(req.url ?? ""); } catch { res.writeHead(400).end(); return; }
    if (url.protocol !== "http:") { res.writeHead(400).end(); return; }
    const port = Number(url.port || 80);
    const addr = await pick(url.hostname, port);
    if (!addr) { res.writeHead(403, { "content-type": "text/plain" }).end("Blocked by SEctOr: private or non-web address"); return; }
    const upstream = httpRequest({ host: addr.address, family: addr.family, port, method: req.method, path: url.pathname + url.search, headers: { ...req.headers, host: url.host } }, (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    });
    upstream.setTimeout(20_000, () => upstream.destroy());
    upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });

  // HTTPS: CONNECT host:port, then a raw TCP tunnel to the checked address.
  // CONNECT tunnels leave the HTTP server's bookkeeping, so close() must destroy them itself.
  const tunnels = new Set<Socket>();
  const track = (s: Socket) => { tunnels.add(s); s.on("close", () => tunnels.delete(s)); };

  server.on("connect", async (req: IncomingMessage, client: Socket, head: Buffer) => {
    track(client);
    client.on("error", () => client.destroy());
    const m = (req.url ?? "").match(/^(\[[^\]]+\]|[^:]+):(\d+)$/);
    const addr = m ? await pick(m[1]!, Number(m[2])) : null;
    if (!m || !addr) { client.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n"); return; }
    if (client.destroyed) return;
    const upstream = connect({ host: addr.address, port: Number(m[2]), family: addr.family }, () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      upstream.pipe(client); client.pipe(upstream);
    });
    track(upstream);
    upstream.setTimeout(30_000, () => upstream.destroy());
    upstream.on("error", () => client.destroy());
    client.on("close", () => upstream.destroy());
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  return {
    port,
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((r) => { for (const s of tunnels) s.destroy(); server.closeAllConnections?.(); server.close(() => r()); }),
  };
}

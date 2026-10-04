import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, request as httpRequest, type Server } from "node:http";
import { connect } from "node:net";
import type { AddressInfo } from "node:net";
import { startGuardedProxy, type GuardedProxy } from "../src/report/proxy.js";

// The browser's only way out (ADR-0007): every connection Chromium or Lighthouse
// makes goes through this proxy, which refuses private/internal addresses.
let target: Server; let targetPort: number;
beforeAll(async () => {
  target = createServer((_q, r) => r.end("internal secret"));
  await new Promise<void>((r) => target.listen(0, "127.0.0.1", r));
  targetPort = (target.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((r) => target.close(() => r())));

function viaProxy(proxy: GuardedProxy, url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port: proxy.port, method: "GET", path: url, headers: { host: new URL(url).host } }, (res) => {
      let body = ""; res.on("data", (c) => (body += c)); res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject); req.end();
  });
}

function connectVia(proxy: GuardedProxy, hostPort: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const s = connect(proxy.port, "127.0.0.1", () => s.write(`CONNECT ${hostPort} HTTP/1.1\r\nHost: ${hostPort}\r\n\r\n`));
    s.once("data", (d) => { resolve(d.toString().split("\r\n")[0]!); s.destroy(); });
    s.on("error", reject);
  });
}

describe("guarded proxy", () => {
  it("refuses plain HTTP to a private address", async () => {
    const proxy = await startGuardedProxy({ allowPrivate: false });
    const res = await viaProxy(proxy, `http://127.0.0.1:${targetPort}/`);
    expect(res.status).toBe(403);
    expect(res.body).not.toContain("internal secret");
    await proxy.close();
  });

  it("refuses CONNECT tunnels to private addresses, including metadata and hostnames that resolve privately", async () => {
    const proxy = await startGuardedProxy({ allowPrivate: false, resolve: async (h) => (h === "rebind.example.org" ? [{ address: "10.0.0.7", family: 4 }] : [{ address: "93.184.216.34", family: 4 }]) });
    expect(await connectVia(proxy, "169.254.169.254:443")).toContain("403");
    expect(await connectVia(proxy, "[::ffff:a9fe:a9fe]:443")).toContain("403");
    expect(await connectVia(proxy, "rebind.example.org:443")).toContain("403");
    await proxy.close();
  });

  it("refuses non-web ports", async () => {
    const proxy = await startGuardedProxy({ allowPrivate: true });
    expect(await connectVia(proxy, `127.0.0.1:22`)).toContain("403");
    await proxy.close();
  });

  it("forwards to the exact address it validated when allowed", async () => {
    const proxy = await startGuardedProxy({ allowPrivate: true, allowPorts: [targetPort] });
    const res = await viaProxy(proxy, `http://127.0.0.1:${targetPort}/`);
    expect(res.status).toBe(200);
    expect(res.body).toBe("internal secret");
    await proxy.close();
  });

  it("close() finishes even while an HTTPS tunnel is still open", async () => {
    const proxy = await startGuardedProxy({ allowPrivate: true, allowPorts: [targetPort] });
    const s = connect(proxy.port, "127.0.0.1", () => s.write(`CONNECT 127.0.0.1:${targetPort} HTTP/1.1\r\n\r\n`));
    await new Promise((r) => s.once("data", r));
    await proxy.close(); // used to wait forever on the open tunnel
    s.destroy();
  });
});

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { request } from "undici";
import { isPrivateAddress, checkPublicUrl, createGuardedAgent, readCapped } from "../src/net-guard.js";

// The SSRF boundary for every server-side fetch of a user-supplied URL (audit
// crawl, robots.txt/llms.txt, WordPress connector). Bypass catalogue: VibeSec
// SSRF table + the 2026-10 review that found mapped-IPv6 and DNS fail-open holes.

describe("isPrivateAddress", () => {
  const blocked = [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "198.18.0.1", "224.0.0.1", "255.255.255.255",
    "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:169.254.169.254", "::ffff:a9fe:a9fe",
    "::ffff:172.16.0.1", "::ffff:ac10:1", "::ffff:100.64.0.1", "64:ff9b::a9fe:a9fe", "2002:a9fe:a9fe::1",
  ];
  const allowed = ["8.8.8.8", "142.250.183.14", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"];
  it.each(blocked)("blocks %s", (ip) => expect(isPrivateAddress(ip)).toBe(true));
  it.each(allowed)("allows %s", (ip) => expect(isPrivateAddress(ip)).toBe(false));
  it("treats anything unparseable as private (fail closed)", () => expect(isPrivateAddress("not-an-ip")).toBe(true));
});

describe("checkPublicUrl (before any connection)", () => {
  const blocked = [
    "http://127.0.0.1/", "http://2130706433/", "http://0177.0.0.1/", "http://127.1/",
    "http://[::ffff:169.254.169.254]/", "http://[::]/", "http://[::1]/",
    "http://localhost/", "http://app.localhost/", "http://metadata.google.internal/", "http://metadata/", "http://intranet/",
    "ftp://example.org/", "file:///etc/passwd", "javascript:alert(1)", "not a url",
  ];
  it.each(blocked)("refuses %s", (u) => expect(checkPublicUrl(u)).toBe(false));
  it.each(["https://example.org/", "http://8.8.8.8/", "https://www.google.org/path?x=1"])("accepts %s", (u) => expect(checkPublicUrl(u)).toBe(true));
});

describe("guarded agent (at connection time)", () => {
  let server: Server; let port: number;
  beforeAll(async () => {
    server = createServer((_q, r) => r.end("internal secret"));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("refuses a public-looking hostname that resolves to a private IP (DNS rebinding)", async () => {
    const agent = createGuardedAgent({ resolve: async () => [{ address: "127.0.0.1", family: 4 }] });
    await expect(request(`http://rebind.example.org:${port}/`, { dispatcher: agent })).rejects.toThrow(/private|not allowed/i);
  });

  it("fails closed when DNS lookup fails", async () => {
    const agent = createGuardedAgent({ resolve: async () => { throw new Error("ENOTFOUND"); } });
    await expect(request(`http://nowhere.example.org:${port}/`, { dispatcher: agent })).rejects.toThrow();
  });

  it("refuses if any resolved address is private (no mixing public and private answers)", async () => {
    const agent = createGuardedAgent({ resolve: async () => [{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }] });
    await expect(request(`http://mixed.example.org:${port}/`, { dispatcher: agent })).rejects.toThrow(/private|not allowed/i);
  });

  it("connects to the exact address it validated", async () => {
    // allowPrivate is the explicit local-dev/test escape hatch; it still pins the resolved address.
    const agent = createGuardedAgent({ allowPrivate: true, resolve: async () => [{ address: "127.0.0.1", family: 4 }] });
    const res = await request(`http://pinned.example.org:${port}/`, { dispatcher: agent });
    expect(await res.body.text()).toBe("internal secret");
  });
});

describe("readCapped", () => {
  it("stops reading past the cap and reports truncation", async () => {
    async function* chunks() { for (let i = 0; i < 100; i++) yield Buffer.alloc(1024, 97); }
    const out = await readCapped(chunks(), 4096);
    expect(out.text.length).toBe(4096);
    expect(out.truncated).toBe(true);
  });
  it("returns small bodies whole", async () => {
    async function* one() { yield Buffer.from("hello"); }
    expect(await readCapped(one(), 4096)).toEqual({ text: "hello", truncated: false });
  });
});

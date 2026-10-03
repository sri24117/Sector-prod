import { BlockList, isIP, isIPv4 } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";
import { Agent, buildConnector } from "undici";

// SSRF boundary for every server-side fetch of a user-supplied URL: the audit
// crawl (page, redirects, robots.txt, llms.txt) and the WordPress connector.
//
// Two layers, both required:
//  1. checkPublicUrl(): cheap pre-check of scheme and host before any request.
//  2. createGuardedAgent(): the check that actually matters. It runs at
//     CONNECTION time on the exact IP being dialled, so DNS rebinding,
//     redirects to private hosts and hostnames that resolve internally are all
//     refused. The validated address is the one connected to (no re-resolve).
// Fails closed: an unparseable address, a DNS failure, or any private answer
// in the resolution is a refusal. ALLOW_PRIVATE_TARGETS=1 (local dev and tests
// against a mock site only) is the single escape hatch; never set it in production.

const v4 = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) v4.addSubnet(net, bits, "ipv4");

const v6 = new BlockList();
for (const [net, bits] of [
  ["::", 128], ["::1", 128], ["100::", 64], ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10],
  ["fec0::", 10], ["ff00::", 8],
] as const) v6.addSubnet(net, bits, "ipv6");

/** Expand an IPv6 string to its 8 hextets (handles "::" and a trailing dotted IPv4). */
function hextets(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0]!;
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const p = dotted[1]!.split(".").map(Number);
    s = s.slice(0, -dotted[1]!.length) + ((p[0]! << 8) | p[1]!).toString(16) + ":" + ((p[2]! << 8) | p[3]!).toString(16);
  }
  const [head, tail] = s.split("::") as [string, string | undefined];
  const h = head ? head.split(":") : [];
  const t = tail !== undefined ? (tail ? tail.split(":") : []) : [];
  const fill = tail !== undefined ? 8 - h.length - t.length : 0;
  const all = [...h, ...Array(Math.max(fill, 0)).fill("0"), ...t].map((x) => parseInt(x, 16));
  return all.length === 8 && all.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff) ? all : null;
}

const embeddedV4 = (a: number, b: number) => `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;

/** True for loopback, private, link-local, metadata, CGNAT, documentation, multicast, reserved, and any unparseable input. */
export function isPrivateAddress(ip: string): boolean {
  const addr = ip.replace(/^\[|\]$/g, "");
  if (isIPv4(addr)) return v4.check(addr, "ipv4");
  if (isIP(addr) !== 6) return true;
  const h = hextets(addr);
  if (!h) return true;
  // IPv4 smuggled inside IPv6: mapped (::ffff:a.b.c.d), compatible (::a.b.c.d), NAT64 (64:ff9b::/96), 6to4 (2002::/16).
  const zeros5 = h.slice(0, 5).every((x) => x === 0);
  if (zeros5 && (h[5] === 0xffff || h[5] === 0) && !(h[5] === 0 && h[6] === 0)) return v4.check(embeddedV4(h[6]!, h[7]!), "ipv4");
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) return v4.check(embeddedV4(h[6]!, h[7]!), "ipv4");
  if (h[0] === 0x2002) return v4.check(embeddedV4(h[1]!, h[2]!), "ipv4");
  return v6.check(addr.split("%")[0]!, "ipv6");
}

const allowPrivateFromEnv = () => process.env.ALLOW_PRIVATE_TARGETS === "1";
const BLOCKED_SUFFIXES = [".localhost", ".internal", ".local", ".home.arpa", ".lan", ".intranet", ".corp"];

/** Pre-check: http(s) only, no embedded credentials, no internal-looking or single-label hostnames, no private IP literals. */
export function checkPublicUrl(raw: string, allowPrivate = allowPrivateFromEnv()): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  if (allowPrivate) return true;
  const host = u.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (isIP(host)) return !isPrivateAddress(host);
  if (host === "localhost" || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return false;
  if (!host.includes(".")) return false; // single-label names resolve via search domains to internal hosts
  return true;
}

export interface ResolvedAddress { address: string; family: number }
type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;
const defaultResolve: Resolver = (h) => dnsLookup(h, { all: true, verbatim: true });

export class PrivateTargetError extends Error {
  constructor(host: string) { super(`Refused: ${host} is a private or internal address and is not allowed`); this.name = "PrivateTargetError"; }
}

/**
 * undici Agent whose every connection is checked on the IP actually dialled.
 * Use it as `dispatcher` for each request to a user-influenced URL.
 */
export function createGuardedAgent(opts: { resolve?: Resolver; allowPrivate?: boolean; connectTimeoutMs?: number; timeoutMs?: number } = {}): Agent {
  const resolve = opts.resolve ?? defaultResolve;
  const allowPrivate = opts.allowPrivate ?? allowPrivateFromEnv();

  // Node calls this instead of DNS for every hostname connection; the addresses we hand back are the ones it dials.
  const lookup = (hostname: string, options: { all?: boolean } | number, cb: (...args: unknown[]) => void) => {
    resolve(hostname).then((addrs) => {
      if (!addrs.length) throw new Error(`No address for ${hostname}`);
      if (!allowPrivate && addrs.some((a) => isPrivateAddress(a.address))) throw new PrivateTargetError(hostname);
      if (typeof options === "object" && options.all) cb(null, addrs);
      else cb(null, addrs[0]!.address, addrs[0]!.family);
    }).catch((err) => cb(err));
  };

  const base = buildConnector({ lookup: lookup as never, timeout: opts.connectTimeoutMs ?? 5_000 });
  return new Agent({
    // IP-literal hosts never reach `lookup`, so check them here too.
    connect: (connectOpts, cb) => {
      const host = connectOpts.hostname.replace(/^\[|\]$/g, "");
      if (!allowPrivate && isIP(host) && isPrivateAddress(host)) { cb(new PrivateTargetError(host), null); return; }
      base(connectOpts, cb);
    },
    headersTimeout: opts.timeoutMs ?? 10_000,
    bodyTimeout: opts.timeoutMs ?? 10_000,
    connections: 4, // per origin: be a polite crawler to small NGO hosts
  });
}

let shared: Agent | undefined;
/** Process-wide guarded agent for production use. */
export function guardedAgent(): Agent {
  return (shared ??= createGuardedAgent());
}

/** Reads at most `maxBytes` of a body, then stops (the stream is destroyed when iteration ends early). */
export async function readCapped(body: AsyncIterable<Uint8Array | string>, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of body) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk);
    if (size + buf.length > maxBytes) {
      parts.push(buf.subarray(0, maxBytes - size));
      return { text: Buffer.concat(parts).toString("utf8"), truncated: true };
    }
    parts.push(buf);
    size += buf.length;
  }
  return { text: Buffer.concat(parts).toString("utf8"), truncated: false };
}

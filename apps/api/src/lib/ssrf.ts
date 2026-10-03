import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Server-side fetches of user-supplied URLs (audit, WordPress connect) are an
// SSRF vector: without this, anyone could point us at 169.254.169.254 or an
// internal service. Blocks loopback/private/link-local unless
// ALLOW_PRIVATE_TARGETS=1 (local dev + tests against a mock site only).
// Known limit: DNS-rebinding between this check and the fetch is not defended.

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    return l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:127.") || l.startsWith("::ffff:10.") || l.startsWith("::ffff:192.168.");
  }
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

export async function isSafePublicUrl(raw: string): Promise<boolean> {
  if (process.env.ALLOW_PRIVATE_TARGETS === "1") return true;
  let host: string;
  try { host = new URL(raw).hostname.replace(/^\[|\]$/g, ""); } catch { return false; }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return false;
  if (isIP(host)) return !isPrivateIp(host);
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return true; // unresolvable: the crawl itself will fail; nothing internal was reached
  }
}

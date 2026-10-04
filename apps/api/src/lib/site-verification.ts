import { resolveTxt } from "node:dns/promises";
import { request } from "undici";
import { guardedAgent, readCapped } from "@sector/shared/net-guard";
import { isSafePublicUrl } from "./ssrf.js";

// Website ownership checks for the full report (spec 2026-10-04-full-report-design.md).
// Three ways to prove control, tried cheapest first. All fetches use the SSRF guard.

export const META_NAME = "sector-site-verification";

/** Comparable host for ownership: lower-case, no trailing dot, no leading "www.". */
export function siteHost(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

export function instructions(token: string, host: string) {
  return {
    metaTag: `<meta name="${META_NAME}" content="${token}">`,
    dnsRecord: { type: "TXT", name: host, value: `${META_NAME}=${token}` },
  };
}

export function wordpressMatches(connectionSiteUrl: string | null | undefined, host: string): boolean {
  if (!connectionSiteUrl) return false;
  try { return siteHost(connectionSiteUrl) === host; } catch { return false; }
}

/** True when the homepage carries <meta name="sector-site-verification" content="<token>">. */
export async function metaTagMatches(siteUrl: string, token: string): Promise<boolean> {
  if (!(await isSafePublicUrl(siteUrl))) return false;
  try {
    const res = await request(siteUrl, { dispatcher: guardedAgent(), signal: AbortSignal.timeout(10_000), headers: { "user-agent": "SEctOrVerify/1.0" } });
    if (res.statusCode >= 300) { await res.body.dump(); return false; }
    const { text } = await readCapped(res.body, 512 * 1024);
    for (const tag of text.match(/<meta\b[^>]*>/gi) ?? []) {
      const name = tag.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1];
      const content = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
      if (name?.toLowerCase() === META_NAME && content === token) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** True when a TXT record "sector-site-verification=<token>" exists on the host. */
export async function dnsMatches(host: string, token: string, resolve: (h: string) => Promise<string[][]> = resolveTxt): Promise<boolean> {
  try {
    const records = await resolve(host);
    return records.some((chunks) => chunks.join("") === `${META_NAME}=${token}`);
  } catch {
    return false;
  }
}

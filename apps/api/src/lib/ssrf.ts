import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { checkPublicUrl, isPrivateAddress } from "@sector/shared/net-guard";

// Early, user-facing check for URLs we are about to fetch (audit, WordPress
// connect). It gives a clear answer before any crawl starts; the real SSRF
// boundary is the guarded agent in @sector/shared/net-guard, which re-checks
// the IP actually dialled on every connection (so DNS rebinding between this
// check and the fetch is covered there). Fails closed: unresolvable = not ok.
// ALLOW_PRIVATE_TARGETS=1 is for local dev and tests against a mock site only.

export type UrlAssessment = "ok" | "blocked" | "unresolvable";

export async function assessUrl(raw: string): Promise<UrlAssessment> {
  if (!checkPublicUrl(raw)) return "blocked";
  if (process.env.ALLOW_PRIVATE_TARGETS === "1") return "ok";
  const host = new URL(raw).hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return "ok"; // literal already checked by checkPublicUrl
  try {
    const addrs = await lookup(host, { all: true, verbatim: true });
    if (!addrs.length) return "unresolvable";
    return addrs.some((a) => isPrivateAddress(a.address)) ? "blocked" : "ok";
  } catch {
    return "unresolvable";
  }
}

export async function isSafePublicUrl(raw: string): Promise<boolean> {
  return (await assessUrl(raw)) === "ok";
}

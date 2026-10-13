// Which website builder produced a page. A hint for the report and for later platform-specific fix
// copy, never a gate: "unknown" and "custom" still get a full audit.
export type Platform = "wordpress" | "wix" | "squarespace" | "webflow" | "shopify" | "custom" | "unknown";

const GENERATOR = (name: string) => new RegExp(`<meta[^>]+name=["']generator["'][^>]+content=["']${name}`, "i");

const SIGNALS: [Exclude<Platform, "custom" | "unknown">, RegExp][] = [
  ["wordpress", new RegExp(`${GENERATOR("WordPress").source}|/wp-content/|/wp-includes/`, "i")],
  ["wix", new RegExp(`static\.wixstatic\.com|${GENERATOR("Wix\.com").source}`, "i")],
  ["squarespace", new RegExp(`static1\.squarespace\.com|squarespace-cdn\.com|${GENERATOR("Squarespace").source}`, "i")],
  ["webflow", new RegExp(`<html[^>]+data-wf-(?:site|page)=|assets\.website-files\.com|uploads-ssl\.webflow\.com|${GENERATOR("Webflow").source}`, "i")],
  ["shopify", /cdn\.shopify\.com|Shopify\.theme/i],
];

export function detectPlatform(html: string, headers: Record<string, string | string[] | undefined>): Platform {
  if (!html.trim()) return "unknown";
  const names = Object.keys(headers).map((k) => k.toLowerCase());
  if (names.some((k) => k.startsWith("x-wix-"))) return "wix";
  if (names.some((k) => k.startsWith("x-shopify-"))) return "shopify";
  for (const [platform, re] of SIGNALS) if (re.test(html)) return platform;
  return "custom";
}

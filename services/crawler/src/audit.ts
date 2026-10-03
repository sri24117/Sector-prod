import * as cheerio from "cheerio";
import { request, type Dispatcher } from "undici";
import { checkPublicUrl, guardedAgent, readCapped } from "@sector/shared/net-guard";

// Every request goes through the guarded agent (SSRF check on the IP actually
// dialled), carries the caller's abort signal, and reads a capped body.
const UA = "SEctOrAuditBot/0.1 (+https://sector.example/bot)";
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_BYTES = 256 * 1024;
interface Net { dispatcher: Dispatcher; signal?: AbortSignal }

// See README.md — this is a reconstruction of the original audit-engine.js
// prototype's documented design, not a re-run of the original file.

export interface CheckResult {
  checkId:
    | "schema"
    | "robots_txt_ai_block"
    | "llms_txt"
    | "heading_hierarchy"
    | "faq_pairs"
    | "front_loaded_stat"
    | "freshness";
  weight: number;
  passed: boolean;
  detail: string;
}

export interface AuditResult {
  url: string;
  score: number;
  runAt: string;
  checks: CheckResult[];
}

const AI_CRAWLER_UA_TOKENS = [
  "GPTBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
];

async function fetchText(url: string, net: Net): Promise<string> {
  const res = await request(url, { headers: { "user-agent": UA }, dispatcher: net.dispatcher, signal: net.signal });
  if (res.statusCode >= 300) { await res.body.dump(); throw new Error(`HTTP ${res.statusCode}`); }
  return (await readCapped(res.body, MAX_TEXT_BYTES)).text;
}

function checkSchema($: cheerio.CheerioAPI): CheckResult {
  const scripts = $('script[type="application/ld+json"]');
  let hasOrgOrArticleOrFaq = false;
  scripts.each((_, el) => {
    try {
      const json = JSON.parse($(el).text());
      const types = Array.isArray(json) ? json.map((j) => j["@type"]) : [json["@type"]];
      const flat = types.flat().filter(Boolean).map(String);
      if (
        flat.some((t) =>
          ["Organization", "NGO", "Article", "BlogPosting", "FAQPage"].includes(t),
        )
      ) {
        hasOrgOrArticleOrFaq = true;
      }
    } catch {
      // malformed JSON-LD counts as not present, not a crash
    }
  });
  return {
    checkId: "schema",
    weight: 20,
    passed: hasOrgOrArticleOrFaq,
    detail: hasOrgOrArticleOrFaq
      ? "JSON-LD schema found (Organization/NGO/Article/FAQPage)"
      : "No relevant JSON-LD schema found",
  };
}

async function checkRobotsTxt(baseUrl: string, net: Net): Promise<CheckResult> {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString();
    const text = await fetchText(robotsUrl, net);
    const blocked = AI_CRAWLER_UA_TOKENS.filter((token) => {
      const re = new RegExp(`User-agent:\\s*${token}[\\s\\S]*?Disallow:\\s*/(?!\\S)`, "i");
      return re.test(text);
    });
    return {
      checkId: "robots_txt_ai_block",
      weight: 15,
      passed: blocked.length === 0,
      detail:
        blocked.length === 0
          ? "No AI crawlers blocked in robots.txt"
          : `Blocks: ${blocked.join(", ")}`,
    };
  } catch {
    // no robots.txt at all = nothing is blocked = check passes
    return {
      checkId: "robots_txt_ai_block",
      weight: 15,
      passed: true,
      detail: "No robots.txt found (nothing blocked)",
    };
  }
}

async function checkLlmsTxt(baseUrl: string, net: Net): Promise<CheckResult> {
  // Kept low-weight deliberately — see skills/audit-engine.md: 97% of
  // published llms.txt files receive zero AI-system requests. This is
  // hygiene, not a growth lever. Do not raise this weight.
  try {
    const llmsUrl = new URL("/llms.txt", baseUrl).toString();
    const res = await request(llmsUrl, { headers: { "user-agent": UA }, dispatcher: net.dispatcher, signal: net.signal });
    await res.body.dump({ limit: MAX_TEXT_BYTES });
    const passed = res.statusCode === 200;
    return {
      checkId: "llms_txt",
      weight: 5,
      passed,
      detail: passed ? "llms.txt present" : "llms.txt not found",
    };
  } catch {
    return { checkId: "llms_txt", weight: 5, passed: false, detail: "llms.txt not found" };
  }
}

function checkHeadingHierarchy($: cheerio.CheerioAPI): CheckResult {
  const h1Count = $("h1").length;
  const h2Count = $("h2").length;
  // Catches the WordPress/Elementor bug where the page title renders as an
  // H2 (or lower) instead of a true H1, and pages with zero or multiple H1s.
  const passed = h1Count === 1 && h2Count > 0;
  return {
    checkId: "heading_hierarchy",
    weight: 15,
    passed,
    detail: `Found ${h1Count} <h1>, ${h2Count} <h2>`,
  };
}

function checkFaqPairs($: cheerio.CheerioAPI): CheckResult {
  // Schema-first: look for FAQPage mainEntity count.
  let faqCount = 0;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).text());
      const entities = Array.isArray(json) ? json : [json];
      for (const entity of entities) {
        if (entity["@type"] === "FAQPage" && Array.isArray(entity.mainEntity)) {
          faqCount = Math.max(faqCount, entity.mainEntity.length);
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  // Heuristic fallback: headings ending in "?" followed by a paragraph.
  if (faqCount === 0) {
    $("h2, h3, h4").each((_, el) => {
      const text = $(el).text().trim();
      if (text.endsWith("?")) faqCount += 1;
    });
  }

  const passed = faqCount >= 3 && faqCount <= 6;
  return {
    checkId: "faq_pairs",
    weight: 20,
    passed,
    detail: `Found ${faqCount} FAQ-style Q&A pairs (target: 3-6)`,
  };
}

function checkFrontLoadedStat($: cheerio.CheerioAPI): CheckResult {
  const bodyText = $("body").text();
  const totalLen = bodyText.length;
  const firstThird = bodyText.slice(0, Math.floor(totalLen * 0.3));
  const hasNumber = /\b\d[\d,.]*%?\b/.test(firstThird);
  return {
    checkId: "front_loaded_stat",
    weight: 15,
    passed: hasNumber,
    detail: hasNumber
      ? "A concrete stat/figure appears in the first 30% of content"
      : "No concrete stat/figure found in the first 30% of content",
  };
}

function checkFreshness($: cheerio.CheerioAPI, lastModifiedHeader?: string): CheckResult {
  const hasTimeTag = $("time").length > 0;
  const hasVisibleUpdated = /last\s+updated/i.test($("body").text());
  const passed = hasTimeTag || hasVisibleUpdated || Boolean(lastModifiedHeader);
  return {
    checkId: "freshness",
    weight: 10,
    passed,
    detail: hasTimeTag
      ? "<time> tag present"
      : hasVisibleUpdated
        ? "Visible 'last updated' text found"
        : lastModifiedHeader
          ? `Last-Modified header: ${lastModifiedHeader}`
          : "No freshness signal found",
  };
}

export interface RunAuditOptions {
  // Pre-check before every page request, including each redirect hop. Defaults
  // to checkPublicUrl; the guarded agent re-checks the real IP at connect time.
  allowUrl?: (url: string) => Promise<boolean>;
  // Abort the whole audit (all its requests), e.g. AbortSignal.timeout(10_000).
  signal?: AbortSignal;
  // Tests may inject an agent; production always uses the guarded one.
  dispatcher?: Dispatcher;
}

const MAX_REDIRECTS = 5;

export async function runAudit(startUrl: string, opts: RunAuditOptions = {}): Promise<AuditResult> {
  const net: Net = { dispatcher: opts.dispatcher ?? guardedAgent(), signal: opts.signal };
  const allowUrl = opts.allowUrl ?? (async (u: string) => checkPublicUrl(u));
  let url = startUrl;
  let res;
  for (let hop = 0; ; hop++) {
    if (!(await allowUrl(url))) throw new Error(`URL not allowed: ${url}`);
    res = await request(url, { headers: { "user-agent": UA }, dispatcher: net.dispatcher, signal: net.signal });
    const location = res.headers.location;
    if (res.statusCode < 300 || res.statusCode >= 400 || typeof location !== "string") break;
    await res.body.dump();
    if (hop >= MAX_REDIRECTS) throw new Error(`Too many redirects from ${startUrl}`);
    url = new URL(location, url).toString();
  }
  const { text: html } = await readCapped(res.body, MAX_HTML_BYTES);
  const $ = cheerio.load(html);
  const lastModified = res.headers["last-modified"] as string | undefined;

  const robots = await checkRobotsTxt(url, net);
  const llms = await checkLlmsTxt(url, net);
  net.signal?.throwIfAborted(); // a timed-out audit stops here instead of reporting partial results
  const checks: CheckResult[] = [
    checkSchema($),
    robots,
    llms,
    checkHeadingHierarchy($),
    checkFaqPairs($),
    checkFrontLoadedStat($),
    checkFreshness($, lastModified),
  ];

  const score = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);

  return { url, score, runAt: new Date().toISOString(), checks };
}

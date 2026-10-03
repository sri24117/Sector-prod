import * as cheerio from "cheerio";
import { request } from "undici";

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

async function fetchText(url: string): Promise<string> {
  const res = await request(url, {
    headers: {
      "user-agent": "SEctOrAuditBot/0.1 (+https://sector.example/bot)",
    },
  });
  return res.body.text();
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

async function checkRobotsTxt(baseUrl: string): Promise<CheckResult> {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString();
    const text = await fetchText(robotsUrl);
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

async function checkLlmsTxt(baseUrl: string): Promise<CheckResult> {
  // Kept low-weight deliberately — see skills/audit-engine.md: 97% of
  // published llms.txt files receive zero AI-system requests. This is
  // hygiene, not a growth lever. Do not raise this weight.
  try {
    const llmsUrl = new URL("/llms.txt", baseUrl).toString();
    const res = await request(llmsUrl);
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
  // Called before every request, including each redirect hop. Callers that
  // audit user-supplied URLs pass their SSRF guard here, so a public URL
  // can't 30x the crawler into a private address.
  allowUrl?: (url: string) => Promise<boolean>;
}

const MAX_REDIRECTS = 5;

export async function runAudit(startUrl: string, opts: RunAuditOptions = {}): Promise<AuditResult> {
  let url = startUrl;
  let res;
  for (let hop = 0; ; hop++) {
    if (opts.allowUrl && !(await opts.allowUrl(url))) throw new Error(`URL not allowed: ${url}`);
    res = await request(url, {
      headers: { "user-agent": "SEctOrAuditBot/0.1 (+https://sector.example/bot)" },
    });
    const location = res.headers.location;
    if (res.statusCode < 300 || res.statusCode >= 400 || typeof location !== "string") break;
    await res.body.dump();
    if (hop >= MAX_REDIRECTS) throw new Error(`Too many redirects from ${startUrl}`);
    url = new URL(location, url).toString();
  }
  const html = await res.body.text();
  const $ = cheerio.load(html);
  const lastModified = res.headers["last-modified"] as string | undefined;

  const checks: CheckResult[] = [
    checkSchema($),
    await checkRobotsTxt(url),
    await checkLlmsTxt(url),
    checkHeadingHierarchy($),
    checkFaqPairs($),
    checkFrontLoadedStat($),
    checkFreshness($, lastModified),
  ];

  const score = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);

  return { url, score, runAt: new Date().toISOString(), checks };
}

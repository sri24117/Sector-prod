// Deterministic fix generation (CLAUDE.md §2: no LLM for anything that must be
// correct). Only fixes we can generate WITHOUT inventing facts about the org.

export interface OrgFacts { name: string; websiteUrl?: string | null; }

export function buildOrganizationJsonLd(org: OrgFacts, siteUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "NGO",
    name: org.name,
    url: org.websiteUrl || siteUrl,
  };
}

// For findings with no live-fix mechanism: the manual fallback package the skill
// requires so no client is left "with literally nothing" (skill §4).
export function manualFixPackage(checkId: string): { title: string; steps: string[] } {
  const packages: Record<string, { title: string; steps: string[] }> = {
    robots_txt_ai_block: { title: "Allow AI crawlers in robots.txt", steps: ["Open your site's robots.txt.", "Remove any 'Disallow: /' rule under User-agent: GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot.", "Save and re-run the audit."] },
    llms_txt: { title: "Add an llms.txt file", steps: ["Create /llms.txt at your site root.", "List your organization name, a one-paragraph mission, and links to your key pages.", "Save and re-run the audit."] },
    heading_hierarchy: { title: "Fix heading hierarchy", steps: ["Ensure each page has exactly one H1.", "Use H2 for main sections, H3 beneath them; do not skip levels."] },
    faq_pairs: { title: "Add FAQ-style content", steps: ["Add 3-5 real questions your beneficiaries/donors ask, each answered directly beneath the question."] },
    front_loaded_stat: { title: "Front-load a key figure", steps: ["Put one concrete, sourced impact figure in the first paragraph of your home/about page."] },
    freshness: { title: "Add a freshness signal", steps: ["Publish or update a dated post/page and expose the date (e.g., datePublished/dateModified)."] },
    schema: { title: "Add Organization schema", steps: ["Add a JSON-LD Organization/NGO block to your site's <head>."] },
  };
  return packages[checkId] ?? { title: "Manual fix", steps: ["No automated or templated fix exists for this check yet."] };
}

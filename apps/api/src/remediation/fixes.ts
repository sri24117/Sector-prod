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
  // Written for the NGO comms person who will do or delegate the fix, not a developer.
  // Each package ends by re-running the audit so the score confirms the change.
  const rerun = "Run the audit again in SEctOr to confirm it now passes.";
  const packages: Record<string, { title: string; steps: string[] }> = {
    robots_txt_ai_block: { title: "Let AI assistants read your site", steps: [
      "Open the file at yourwebsite/robots.txt in your browser to see what it says.",
      "Ask whoever manages your website to remove the lines that block GPTBot, ClaudeBot, PerplexityBot, Google-Extended or CCBot. The Technical detail above lists the ones blocked on your site.",
      "On WordPress, an SEO plugin such as Yoast or Rank Math usually has a robots.txt editor under its Tools settings.",
      rerun,
    ] },
    llms_txt: { title: "Add a short summary file for AI tools", steps: [
      "Write a plain text file named llms.txt with your organization name, a one-paragraph description of your work, and links to your main pages.",
      "Ask whoever manages your website to upload it so it opens at yourwebsite/llms.txt.",
      "This is a small, optional improvement. Fix the other items first.",
      rerun,
    ] },
    heading_hierarchy: { title: "Give your page clear headings", steps: [
      "Make sure the page has one main heading (Heading 1) that says what the page is about, usually your organization name or purpose.",
      "Use Heading 2 for each section beneath it, for example \"Our work\", \"Where we work\", \"How to help\".",
      "In the WordPress editor, choose the heading level from the block toolbar. Some themes show the page title as Heading 2, so check the main title too.",
      rerun,
    ] },
    faq_pairs: { title: "Answer common questions on the page", steps: [
      "List three to six questions people really ask you, for example \"Who do you work with?\" or \"How is my donation used?\".",
      "Add each question to the page as a heading ending in a question mark, with a short, direct answer just below it.",
      rerun,
    ] },
    front_loaded_stat: { title: "Put your key number near the top", steps: [
      "Pick the one figure that best shows your impact, for example \"1,200 children reached in 2025\". Use a number you can stand behind.",
      "Put it in the first paragraph of your home or about page.",
      rerun,
    ] },
    freshness: { title: "Show when the page was last updated", steps: [
      "Add a visible line such as \"Last updated: 3 October 2026\" to the page, and change it whenever you update the content.",
      "Posting regular news or updates also helps, because each post carries its own date.",
      rerun,
    ] },
    schema: { title: "Describe your organization in the standard format", steps: [
      "On WordPress, connect your site in SEctOr (Audits page, WordPress connection) and SEctOr adds this for you.",
      "Otherwise, ask whoever manages your website to add Organization (or NGO) structured data, written in the JSON-LD format, with your organization name and website address.",
      rerun,
    ] },
  };
  return packages[checkId] ?? { title: "Manual fix", steps: ["No automated or templated fix exists for this check yet."] };
}

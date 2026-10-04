// Plain-language copy for the seven audit checks (services/crawler/src/audit.ts).
// Reader: a generalist NGO comms person, not an SEO specialist. Each entry says
// what we found in everyday words, and, when something needs attention, why it
// matters. Claims stay within what the check actually tests; see
// skills/audit-engine.md (e.g. llms.txt is hygiene, not a growth lever).
// The crawler's own technical detail is still shown, smaller, for whoever
// maintains the site.

export interface CheckCopy {
  title: string;
  passed: string;
  failed: string;
  why: string;
  /** Score points this check is worth (services/crawler weights, skills/audit-engine.md). */
  weight: number;
  /** Honest effort estimate in plain words, shown on the insight card. */
  effort: string;
}

export const CHECKS: Record<string, CheckCopy> = {
  schema: {
    title: "Search engines can tell who you are",
    passed: "Your site describes your organization in the standard format search engines and AI assistants read directly.",
    failed: "Your site doesn't describe your organization in the standard format that search engines and AI assistants read directly.",
    why: "Without it they have to guess your name, purpose and website from the page text, and may get it wrong or leave you out.",
    weight: 20,
    effort: "About 10 minutes, or we do it for you on WordPress",
  },
  robots_txt_ai_block: {
    title: "AI assistants are allowed to read your site",
    passed: "Your site doesn't block AI assistants such as ChatGPT, Claude or Perplexity.",
    failed: "Your site tells some AI assistants not to read it.",
    why: "Assistants that can't read your site are less likely to mention your work when someone asks about causes like yours.",
    weight: 15,
    effort: "About 10 minutes with your web person",
  },
  llms_txt: {
    title: "A summary file for AI tools",
    passed: "Your site has an llms.txt file summarising it for AI tools.",
    failed: "Your site doesn't have an llms.txt file, a short summary some AI tools look for.",
    why: "Few AI tools use this file yet, so it counts for little. It takes minutes to add, but fix the other items first.",
    weight: 5,
    effort: "About 15 minutes, low priority",
  },
  heading_hierarchy: {
    title: "Clear page headings",
    passed: "Your page has one main heading with section headings beneath it.",
    failed: "Your page doesn't have one main heading followed by section headings.",
    why: "Headings are how search engines and AI assistants work out what a page is about and which part answers which question.",
    weight: 15,
    effort: "About 20 minutes",
  },
  faq_pairs: {
    title: "Common questions, answered",
    passed: "Your page answers a handful of common questions in a question-and-answer format.",
    failed: "Your page doesn't answer common questions in a question-and-answer format. Three to six is ideal.",
    why: "AI assistants often quote short, direct answers. Questions like \"Who do you work with?\" make yours easy to find and repeat.",
    weight: 20,
    effort: "About 30 to 60 minutes of writing",
  },
  front_loaded_stat: {
    title: "Your impact in numbers, near the top",
    passed: "A clear figure appears near the top of your page.",
    failed: "There's no clear figure, such as children reached or villages served, near the top of your page.",
    why: "Specific numbers are what AI assistants, journalists and funders quote. Put your most important one where people see it first.",
    weight: 15,
    effort: "About 10 minutes",
  },
  freshness: {
    title: "Signs the page is kept up to date",
    passed: "Your page shows when it was last updated.",
    failed: "Nothing on your page shows when it was last updated.",
    why: "Search engines and AI assistants prefer information that looks current. A visible date tells them, and your visitors, that it is.",
    weight: 10,
    effort: "About 10 minutes",
  },
};

export function checkCopy(id: string): CheckCopy {
  return CHECKS[id] ?? { title: id, passed: "Passed.", failed: "Needs attention.", why: "", weight: 0, effort: "" };
}

/** Points a finding is worth: the crawler's own weight when present, else the known default. */
export function pointsFor(f: { checkId: string; weight?: number }): number {
  return f.weight ?? checkCopy(f.checkId).weight;
}

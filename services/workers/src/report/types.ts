// Data gathered for a full report (spec 2026-10-04-full-report-design.md).

export interface PageFacts {
  url: string;
  status: number;
  title: string;
  metaDescription: string;
  canonical: string;
  lang: string;
  hasViewport: boolean;
  h1: number;
  h2: number;
  jsonLdTypes: string[];
  images: number;
  imagesMissingAlt: number;
  words: number;
  internalLinks: string[];
  socialLinks: string[];
  og: { title?: string; description?: string; image?: string };
  twitterCard?: string;
}

export interface LighthouseResult {
  url: string;
  scores: { performance: number; seo: number; accessibility: number; bestPractices: number }; // 0-100
  metrics: { lcpMs?: number; cls?: number; tbtMs?: number };
  failed: { id: string; title: string }[];
}

export interface AxeViolation { id: string; impact: "minor" | "moderate" | "serious" | "critical" | null; help: string; nodes: number }

export interface SocialProfile { platform: string; url: string; state: "ok" | "broken" | "unchecked" }

export interface ReportData {
  siteUrl: string;
  organizationName: string;
  generatedAt: string;
  pages: PageFacts[];
  brokenLinks: { url: string; status: number; foundOn: string }[];
  lighthouse: LighthouseResult[];
  axe: AxeViolation[];
  screenshots: { desktop?: string; mobile?: string }; // base64 JPEG
  social: SocialProfile[];
  notes: string[]; // anything we could not check, said plainly
}

export type Impact = "high" | "medium" | "low";
export interface Action {
  title: string;
  why: string;
  impact: Impact;
  effort: string;
  owner: "You" | "Your web person" | "SEctOr (WordPress)";
  where: string[];
  section: "Search" | "Website health" | "Accessibility" | "Social and sharing";
}

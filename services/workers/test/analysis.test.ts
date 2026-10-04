import { describe, it, expect } from "vitest";
import { socialProfilesFrom, buildActions, bucketOf, overallScore } from "../src/report/analysis.js";
import { renderReportHtml, esc } from "../src/report/render.js";
import type { PageFacts, ReportData } from "../src/report/types.js";

const page = (over: Partial<PageFacts> = {}): PageFacts => ({
  url: "https://ngo.example.org/", status: 200, title: "Asha Foundation", metaDescription: "We teach children to read.", canonical: "https://ngo.example.org/",
  lang: "en", hasViewport: true, h1: 1, h2: 3, jsonLdTypes: ["NGO"], images: 4, imagesMissingAlt: 0, words: 600, internalLinks: [], socialLinks: [],
  og: { title: "Asha", description: "Reading", image: "https://ngo.example.org/og.jpg" }, twitterCard: "summary_large_image", ...over,
});

const data = (over: Partial<ReportData> = {}): ReportData => ({
  siteUrl: "https://ngo.example.org/", organizationName: "Asha Foundation", generatedAt: "2026-10-04T10:00:00.000Z",
  pages: [page()], brokenLinks: [], lighthouse: [{ url: "https://ngo.example.org/", scores: { performance: 90, seo: 95, accessibility: 92, bestPractices: 100 }, metrics: { lcpMs: 1800, cls: 0.02, tbtMs: 100 }, failed: [] }],
  axe: [], screenshots: {}, social: [], notes: [], ...over,
});

describe("social profiles", () => {
  it("finds one link per platform, ignoring share buttons and duplicates", () => {
    const found = socialProfilesFrom([
      "https://www.facebook.com/ashafoundation", "https://facebook.com/ashafoundation/", "https://www.facebook.com/sharer/sharer.php?u=x",
      "https://instagram.com/asha.ngo", "https://www.linkedin.com/company/asha", "https://youtube.com/@asha", "https://x.com/asha", "https://wa.me/919999999999",
      "https://example.org/not-social",
    ]);
    expect(found.map((f) => f.platform)).toEqual(["Facebook", "Instagram", "LinkedIn", "YouTube", "X (Twitter)", "WhatsApp"]);
  });
});

describe("action plan", () => {
  it("a healthy site gets no high-impact actions", () => {
    expect(buildActions(data()).filter((a) => a.impact === "high")).toHaveLength(0);
  });

  it("turns real problems into plain, owned actions with the pages they affect", () => {
    const actions = buildActions(data({
      pages: [page({ url: "https://ngo.example.org/", jsonLdTypes: [], og: {} }), page({ url: "https://ngo.example.org/about", title: "", metaDescription: "", h1: 0, imagesMissingAlt: 3 })],
      brokenLinks: [{ url: "https://ngo.example.org/old", status: 404, foundOn: "https://ngo.example.org/about" }],
      lighthouse: [{ url: "https://ngo.example.org/", scores: { performance: 35, seo: 80, accessibility: 70, bestPractices: 90 }, metrics: { lcpMs: 6200 }, failed: [] }],
      axe: [{ id: "color-contrast", impact: "serious", help: "Elements must meet minimum color contrast ratio thresholds", nodes: 12 }],
    }));
    const titles = actions.map((a) => a.title);
    expect(titles).toContain("Tell search engines who you are");
    expect(titles).toContain("Give every page a title");
    expect(titles).toContain("Fix links that go nowhere");
    expect(titles).toContain("Make your homepage load faster");
    expect(titles).toContain("Add a share preview for WhatsApp, LinkedIn and Facebook");
    const schema = actions.find((a) => a.title === "Tell search engines who you are")!;
    expect(schema.owner).toBe("SEctOr (WordPress)");
    expect(actions.find((a) => a.title === "Give every page a title")!.where).toEqual(["https://ngo.example.org/about"]);
    // Sorted: high impact first.
    expect(actions[0]!.impact).toBe("high");
    expect(bucketOf(actions[0]!)).toBe("Do first");
  });

  it("the same fix from two checks appears once, at the higher impact", () => {
    const actions = buildActions(data({
      pages: [page({ imagesMissingAlt: 2 })],
      axe: [{ id: "image-alt", impact: "critical", help: "Images must have alternate text", nodes: 2 }],
    }));
    const images = actions.filter((a) => a.title === "Describe your images");
    expect(images).toHaveLength(1);
    expect(images[0]!.impact).toBe("high");
  });

  it("overall score is the mean of the four Lighthouse areas on the homepage", () => {
    expect(overallScore(data())).toBe(94);
    expect(overallScore(data({ lighthouse: [] }))).toBeNull();
  });
});

describe("report html", () => {
  it("escapes scraped text so a page title cannot inject markup", () => {
    expect(esc(`<script>alert("x")</script>&`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;");
    const html = renderReportHtml(data({ pages: [page({ title: `<img src=x onerror=alert(1)>` })] }), buildActions(data()));
    expect(html).not.toContain("<img src=x onerror");
    expect(html).not.toMatch(/<script/i);
  });

  it("contains every section and the action plan, in plain language", () => {
    const html = renderReportHtml(data(), buildActions(data()));
    for (const heading of ["Summary", "Search", "Website health", "Accessibility", "Social and sharing", "Your action plan"]) expect(html).toContain(heading);
    expect(html).toContain("Asha Foundation");
  });
});

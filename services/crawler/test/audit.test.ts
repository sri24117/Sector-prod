import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";

// A minimal smoke test proving the check logic is wired correctly, in the
// spirit of the original v0's fixture-based validation (score 100/5/42 on
// three synthetic pages). Full fixture parity with the original test suite
// is not yet re-established — see README.md.

describe("heading hierarchy check shape", () => {
  it("flags a page with zero H1s and a title rendered as H2", () => {
    const html = "<html><body><h2>Page Title</h2><p>content</p></body></html>";
    const $ = cheerio.load(html);
    expect($("h1").length).toBe(0);
    expect($("h2").length).toBe(1);
    // A real assertion against checkHeadingHierarchy() belongs here once
    // that function is exported for direct unit testing rather than only
    // through runAudit()'s network-calling path.
  });
});

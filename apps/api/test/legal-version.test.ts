import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { LEGAL_VERSION } from "../src/lib/legal.js";

// Signup records LEGAL_VERSION as the version a person accepted, so it must name the text
// actually shown at /terms and /privacy (rendered from these files).
describe("LEGAL_VERSION", () => {
  it.each(["terms-of-service.md", "privacy-policy.md"])("matches the Version line in docs/legal/%s", (file) => {
    const text = readFileSync(new URL(`../../../docs/legal/${file}`, import.meta.url), "utf8");
    expect(text).toMatch(new RegExp(`^Version: ${LEGAL_VERSION.replace(/[.-]/g, "\\$&")}\\.`, "m"));
  });
});

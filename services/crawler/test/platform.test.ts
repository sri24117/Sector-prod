import { describe, it, expect } from "vitest";
import { detectPlatform } from "../src/platform.js";

const page = (head: string, body = "<p>Hello</p>") => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe("detectPlatform", () => {
  it.each([
    ["wordpress", page('<meta name="generator" content="WordPress 6.5">')],
    ["wordpress", page('<link rel="stylesheet" href="/wp-content/themes/x/style.css">')],
    ["wix", page('<script src="https://static.wixstatic.com/services/x.js"></script>')],
    ["wix", page('<meta name="generator" content="Wix.com Website Builder">')],
    ["squarespace", page('<script src="https://static1.squarespace.com/static/x.js"></script>')],
    ["webflow", '<!doctype html><html data-wf-site="abc" data-wf-page="def"><head></head><body>x</body></html>'],
    ["webflow", page('<link href="https://assets.website-files.com/x.css">')],
    ["shopify", page('<script src="https://cdn.shopify.com/s/files/x.js"></script>')],
  ])("detects %s", (expected, html) => {
    expect(detectPlatform(html, {})).toBe(expected);
  });

  it("detects Wix and Shopify from response headers alone", () => {
    expect(detectPlatform(page(""), { "x-wix-request-id": "1" })).toBe("wix");
    expect(detectPlatform(page(""), { "x-shopid": "1", "x-shopify-stage": "production" })).toBe("shopify");
  });

  it("calls an unrecognised page custom and an empty response unknown", () => {
    expect(detectPlatform(page('<title>Plain</title>'), {})).toBe("custom");
    expect(detectPlatform("", {})).toBe("unknown");
    expect(detectPlatform("   \n", {})).toBe("unknown");
  });

  it("treats dots in host signals as literal, not wildcards", () => {
    for (const head of [
      '<script src="https://staticXwixstatic.com/a.js"></script>',
      '<script src="https://static1Xsquarespace.com/a.js"></script>',
      '<link href="https://assetsXwebsite-filesXcom/x.css">',
      '<link href="https://uploads-sslXwebflow.com/x.css">',
      '<script src="https://cdnXshopify.com/x.js"></script>',
      '<meta name="generator" content="WixXcom">',
    ]) {
      expect(detectPlatform(page(head), {})).toBe("custom");
    }
  });

  it("does not confuse a page that merely mentions WordPress in its text", () => {
    expect(detectPlatform(page("", "<p>We built this with WordPress and love it.</p>"), {})).toBe("custom");
  });
});

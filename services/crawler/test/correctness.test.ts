import { describe, it, expect } from "vitest";
import { MockAgent } from "undici";
import { robotsBlocksRoot, runAudit } from "../src/audit.js";

describe("robots groups", () => {
  it("applies wildcard restrictions but prefers an explicit bot group", () => {
    expect(robotsBlocksRoot("User-agent: *\nDisallow: /", "GPTBot")).toBe(true);
    expect(robotsBlocksRoot("User-agent: GPTBot\nAllow: /\nUser-agent: OtherBot\nDisallow: /", "GPTBot")).toBe(false);
    expect(robotsBlocksRoot("User-agent: *\nDisallow: /\nUser-agent: GPTBot\nAllow: /", "GPTBot")).toBe(false);
    expect(robotsBlocksRoot("User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /", "ClaudeBot")).toBe(true);
  });
  it("honors allow ties and does not confuse private paths with the homepage", () => {
    expect(robotsBlocksRoot("User-agent: *\nDisallow: /private", "GPTBot")).toBe(false);
    expect(robotsBlocksRoot("User-agent: *\nDisallow: /\nAllow: /$", "GPTBot")).toBe(false);
  });
});
async function assess(status: number, robotsStatus = 200) {
  const agent = new MockAgent(); agent.disableNetConnect(); const site = agent.get("https://ngo.example");
  site.intercept({ path: "/" }).reply(status, '<html><head><script type="application/ld+json">{"@graph":[{"@type":"NGO","name":"Hope"}]}</script></head><body><h1>Hope</h1></body></html>', { headers: { "content-type": "text/html" } });
  if (status === 200) {
    site.intercept({ path: "/robots.txt" }).reply(robotsStatus, "User-agent: *\nDisallow: /", { headers: { "content-type": "text/plain" } });
    site.intercept({ path: "/llms.txt" }).reply(200, '<!doctype html><html>Fallback</html>', { headers: { "content-type": "text/html" } });
  }
  try { return await runAudit("https://ngo.example/", { dispatcher: agent, allowUrl: async () => true }); } finally { await agent.close(); }
}
it("recognizes graph schema, wildcard blocking and rejects HTML llms fallback", async () => {
  const a = await assess(200), check = (id: string) => a.checks.find((c) => c.checkId === id)!;
  expect(check("schema").passed).toBe(true);
  expect(check("robots_txt_ai_block").passed).toBe(false);
  expect(check("llms_txt").passed).toBe(false);
});
it("does not score an unavailable homepage", async () => { await expect(assess(503)).rejects.toThrow("HTTP 503"); });
it("does not pass an unreadable robots resource", async () => {
  expect((await assess(200, 503)).checks.find((c) => c.checkId === "robots_txt_ai_block")).toMatchObject({ passed: false, detail: expect.stringContaining("unknown") });
});

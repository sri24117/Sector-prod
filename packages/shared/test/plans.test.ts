import { describe, it, expect } from "vitest";
import { CONTENT_ALLOWANCE, SETTABLE_PLANS, hasFeature, monthStartIst, normalizePlan, planRequiredMessage } from "../src/plans.js";

describe("plans", () => {
  it("treats legacy pilot and paid as starter; unknown values get no paid access", () => {
    expect(normalizePlan("pilot")).toBe("starter");
    expect(normalizePlan("paid")).toBe("starter");
    for (const p of ["free", "starter", "growth", "pro"]) expect(normalizePlan(p)).toBe(p);
    expect(normalizePlan("enterprise")).toBe("free");
    expect(normalizePlan(null)).toBe("free");
  });

  it("matches the documented tier table", () => {
    const table = {
      full_report: ["free:no", "starter:yes", "growth:yes", "pro:yes"],
      wordpress_fix: ["free:no", "starter:yes", "growth:yes", "pro:yes"],
      content: ["free:no", "starter:yes", "growth:yes", "pro:yes"],
      ad_grants: ["free:no", "starter:no", "growth:no", "pro:yes"],
    } as const;
    for (const [feature, cells] of Object.entries(table)) {
      for (const cell of cells) {
        const [plan, yes] = cell.split(":");
        expect(hasFeature(plan, feature as keyof typeof table), `${plan} ${feature}`).toBe(yes === "yes");
      }
    }
    expect(hasFeature("pilot", "full_report")).toBe(true);
    expect(hasFeature("paid", "ad_grants")).toBe(false);
  });

  it("content allowance: starter 15, growth and pro unset (no cap)", () => {
    expect(CONTENT_ALLOWANCE).toMatchObject({ free: 0, starter: 15, growth: null, pro: null });
  });

  it("names the plan that is needed", () => {
    expect(planRequiredMessage("full_report")).toContain("Starter");
    expect(planRequiredMessage("ad_grants")).toContain("Pro");
  });

  it("set-plan accepts current and legacy names only", () => {
    expect([...SETTABLE_PLANS].sort()).toEqual(["free", "growth", "paid", "pilot", "pro", "starter"]);
  });

  it("month starts at midnight on the 1st in Asia/Kolkata", () => {
    expect(monthStartIst(new Date("2026-10-15T10:00:00Z")).toISOString()).toBe("2026-09-30T18:30:00.000Z");
    // 20:00 UTC on 30 Sep is already 1 Oct in India
    expect(monthStartIst(new Date("2026-09-30T20:00:00Z")).toISOString()).toBe("2026-09-30T18:30:00.000Z");
    expect(monthStartIst(new Date("2026-09-30T18:29:00Z")).toISOString()).toBe("2026-08-31T18:30:00.000Z");
  });
});

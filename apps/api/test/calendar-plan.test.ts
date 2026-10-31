import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { rawDb, pool, schema } from "@sector/db";
import { buildApp } from "../src/app.js";
import type { FastifyInstance } from "fastify";
import { OBJECTIVES, THREE_MONTH_UNLOCK_EXPORTED, suggestPlan, todayIst } from "../src/lib/calendar-plan.js";

// docs/plans/feature-spec-calendar-planner.md: suggested plan, nothing stored, three months unlock by use.

describe("suggestPlan (pure)", () => {
  const WEEKDAY_OK = new Set([1, 3, 5]);

  it("gives 12 slots for one month, all Mon/Wed/Fri, inside Starter's 15-piece allowance", () => {
    const slots = suggestPlan({ start: "2026-11-02", months: 1 });
    expect(slots).toHaveLength(12);
    expect(slots.length).toBeLessThanOrEqual(15);
    for (const s of slots) expect(WEEKDAY_OK.has(new Date(`${s.date}T00:00:00Z`).getUTCDay())).toBe(true);
    expect(slots[0]!.date).toBe("2026-11-02");
    expect(slots.at(-1)!.date <= "2026-11-29").toBe(true);
  });

  it("gives 36 slots for three months, 12 in each four-week block", () => {
    const slots = suggestPlan({ start: "2026-11-02", months: 3 });
    expect(slots).toHaveLength(36);
    expect(slots.filter((s) => s.date < "2026-11-30")).toHaveLength(12);
  });

  it("counts the start day itself and never goes before it", () => {
    const slots = suggestPlan({ start: "2026-11-04", months: 1 }); // a Wednesday
    expect(slots[0]!.date).toBe("2026-11-04");
    expect(slots.every((s) => s.date >= "2026-11-04")).toBe(true);
    expect(slots).toHaveLength(12);
  });

  it("rotates channels and objectives, defaults to Facebook and Instagram, and ignores duplicate channels", () => {
    const def = suggestPlan({ start: "2026-11-02", months: 1 });
    expect(new Set(def.map((s) => s.channel))).toEqual(new Set(["facebook", "instagram"]));
    expect(new Set(def.map((s) => s.objective)).size).toBe(OBJECTIVES.length);
    const dup = suggestPlan({ start: "2026-11-02", months: 1, channels: ["email", "email"] });
    expect(new Set(dup.map((s) => s.channel))).toEqual(new Set(["email"]));
  });

  it("invents nothing about the organization: hints tell the writer to bring real facts", () => {
    for (const s of suggestPlan({ start: "2026-11-02", months: 1 })) expect(s.hint.length).toBeGreaterThan(10);
    expect(OBJECTIVES.every((o) => o.objective.length >= 3 && o.objective.length <= 300)).toBe(true); // fits the calendar's objective field
  });

  it("todayIst follows Asia/Kolkata, not UTC", () => {
    expect(todayIst(new Date("2026-11-01T19:00:00Z"))).toBe("2026-11-02"); // 00:30 IST next day
    expect(todayIst(new Date("2026-11-01T17:00:00Z"))).toBe("2026-11-01");
  });
});

describe("GET /calendar/plan", () => {
  let app: FastifyInstance; let signupIp = 100;
  beforeAll(async () => { app = await buildApp(); await app.ready(); });
  afterAll(async () => { await pool.query("TRUNCATE organizations, users CASCADE"); await app.close(); await pool.end(); });

  async function org(tag: string, plan = "starter") {
    const r = await app.inject({ method: "POST", url: "/auth/signup", remoteAddress: `192.0.2.${++signupIp}`, payload: { acceptTerms: true, name: "Coordinator", email: `${tag}@example.org`, password: "long-pilot-password", organizationName: tag } });
    await rawDb.update(schema.organizations).set({ plan }).where(eq(schema.organizations.id, r.json().organizationId));
    const cookie = r.cookies.find((c) => c.name === "sector_session")!;
    return { cookie: `${cookie.name}=${cookie.value}`, ...r.json() } as { cookie: string; organizationId: string; userId: string };
  }
  const get = (cookie: string, url: string) => app.inject({ method: "GET", url, headers: { cookie } });
  const exportPieces = (o: { organizationId: string; userId: string }, n: number) => rawDb.insert(schema.contentAssets).values(
    Array.from({ length: n }, (_, i) => ({ organizationId: o.organizationId, kind: "social_post", title: `Exported piece ${i + 1}`, body: "Text of an exported piece.", status: "exported", createdBy: o.userId })));

  it("gives a Starter organization a one-month plan and writes nothing", async () => {
    const a = await org("plan-a");
    const res = await get(a.cookie, "/calendar/plan?start=2026-11-02");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.months).toBe(1); expect(body.slots).toHaveLength(12);
    expect(body.threeMonth).toEqual({ unlocked: false, exported: 0, needed: THREE_MONTH_UNLOCK_EXPORTED });
    expect((await get(a.cookie, "/calendar")).json()).toEqual([]);
    expect((await get(a.cookie, "/content")).json()).toEqual([]);
  });

  it("refuses a Free organization and an unauthenticated caller", async () => {
    const free = await org("plan-free", "free");
    expect((await get(free.cookie, "/calendar/plan")).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/calendar/plan" })).statusCode).toBe(401);
  });

  it("lets a viewer read the suggestions", async () => {
    const v = await org("plan-viewer");
    await rawDb.update(schema.memberships).set({ role: "viewer" }).where(eq(schema.memberships.organizationId, v.organizationId));
    expect((await get(v.cookie, "/calendar/plan")).statusCode).toBe(200);
  });

  it("rejects bad input with a plain message", async () => {
    const a = await org("plan-bad");
    for (const q of ["months=2", "start=2026-02-30", "start=tomorrow", "channels=tiktok"]) {
      const res = await get(a.cookie, `/calendar/plan?${q}`);
      expect(res.statusCode, q).toBe(400);
      expect(res.json().error).toBe("invalid_input");
    }
  });

  it("honours the chosen channels", async () => {
    const a = await org("plan-channels");
    const res = await get(a.cookie, "/calendar/plan?start=2026-11-02&channels=email,linkedin");
    expect(new Set(res.json().slots.map((s: { channel: string }) => s.channel))).toEqual(new Set(["email", "linkedin"]));
  });

  it("keeps the three-month plan locked below the threshold and says how many are needed", async () => {
    const a = await org("plan-locked");
    await exportPieces(a, THREE_MONTH_UNLOCK_EXPORTED - 1);
    const res = await get(a.cookie, "/calendar/plan?months=3&start=2026-11-02");
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("three_month_locked");
    expect(res.json().threeMonth).toEqual({ unlocked: false, exported: THREE_MONTH_UNLOCK_EXPORTED - 1, needed: 1 });
    expect(res.json().message).toContain("1 more");
    expect(res.json().slots).toBeUndefined();
  });

  it("opens the three-month plan at the threshold", async () => {
    const a = await org("plan-open");
    await exportPieces(a, THREE_MONTH_UNLOCK_EXPORTED);
    const res = await get(a.cookie, "/calendar/plan?months=3&start=2026-11-02");
    expect(res.statusCode).toBe(200);
    expect(res.json().slots).toHaveLength(36);
    expect((await get(a.cookie, "/calendar/plan?start=2026-11-02")).json().threeMonth.unlocked).toBe(true);
  });

  it("does not count drafts or another organization's exports", async () => {
    const a = await org("plan-iso-a"), b = await org("plan-iso-b");
    await exportPieces(b, THREE_MONTH_UNLOCK_EXPORTED + 2);
    await rawDb.insert(schema.contentAssets).values(
      Array.from({ length: THREE_MONTH_UNLOCK_EXPORTED }, (_, i) => ({ organizationId: a.organizationId, kind: "social_post", title: `Draft ${i}`, body: "Not exported yet.", status: "draft", createdBy: a.userId })));
    const res = await get(a.cookie, "/calendar/plan?months=3");
    expect(res.statusCode).toBe(403);
    expect(res.json().threeMonth.exported).toBe(0);
  });
});

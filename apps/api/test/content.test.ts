import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { pool, rawDb, schema } from "@sector/db";
import { anthropicProvider, type LlmProvider } from "@sector/ai";
import { buildApp } from "../src/app.js";
import { missingConsent } from "../src/content/consent.js";

const prompts: string[] = [];
// A fake LLM that echoes placeholders it was given, like a real model told to use them.
const fake: LlmProvider = { async complete({ prompt }) { prompts.push(prompt); const tok = prompt.match(/\[BENEFICIARY_\d+\]/)?.[0] ?? "the family"; return { text: `${tok} rebuilt her life after joining our program.`, model: "fake-model" }; } };
let app: FastifyInstance;
const call = (cookie: string, method: "GET" | "POST" | "PUT", url: string, payload?: unknown) => app.inject({ method, url, headers: { cookie }, payload: payload as never });
async function signup(name: string, email: string) {
  const r = await app.inject({ method: "POST", url: "/auth/signup", payload: { organizationName: name, name: "O", email, password: "long-enough-password" } });
  const c = r.cookies.find((x) => x.name === "sector_session")!; return { cookie: `${c.name}=${c.value}`, userId: r.json().userId as string };
}
const gen = (cookie: string, extra: object = {}) => call(cookie, "POST", "/content/generate", { kind: "case_study", topic: "Asha's story", facts: ["Asha Devi joined our tailoring program in 2024", "She now earns a stable income"], beneficiaries: ["Asha Devi"], ...extra });
beforeAll(async () => { app = await buildApp({ llmProvider: fake }); await app.ready(); });
afterAll(async () => { await pool.query("TRUNCATE organizations, users, memberships, organization_profiles, sessions, security_event_log CASCADE"); await app.close(); await pool.end(); });

describe("consent matching (pure)", () => {
  it("is case/space-insensitive, requires scope, ignores nobody-else's consent", () => {
    expect(missingConsent(["Asha  Devi"], "case_study", [{ subjectName: "asha devi", scope: "story" }])).toEqual([]);
    expect(missingConsent(["Asha Devi"], "case_study", [{ subjectName: "Asha Devi", scope: "photo" }])).toEqual(["Asha Devi"]);
    expect(missingConsent(["Asha Devi"], "quote", [{ subjectName: "Asha Devi", scope: "all" }])).toEqual([]);
    expect(missingConsent(["Asha Devi"], "quote", [{ subjectName: "Someone Else", scope: "all" }])).toEqual(["Asha Devi"]);
  });
});

describe("Slice 5: content + consent gate", () => {
  let A: Awaited<ReturnType<typeof signup>>; let B: Awaited<ReturnType<typeof signup>>; let assetId: string;

  it("brand kit is stored and used; generation drafts with the beneficiary name NEVER sent to the LLM", async () => {
    A = await signup("Hope NGO", "a@hope.org"); B = await signup("Other NGO", "b@other.org");
    expect((await call(A.cookie, "PUT", "/brand-kit", { voice: "Warm, dignified, plain language; never pity." })).statusCode).toBe(200);
    const r = await gen(A.cookie);
    expect(r.statusCode).toBe(201);
    const a = r.json(); assetId = a.id;
    expect(a.status).toBe("draft"); expect(a.beneficiaryRefs).toEqual(["Asha Devi"]);
    expect(a.body).toContain("Asha Devi");                       // restored for the human
    expect(prompts.join("\n")).not.toMatch(/Asha/);              // never reached the provider
    expect(prompts.join("\n")).toContain("[BENEFICIARY_1]");
  });

  it("NEGATIVE: approved asset naming a beneficiary CANNOT be exported without consent", async () => {
    expect((await call(A.cookie, "POST", `/content/${assetId}/approve`)).statusCode).toBe(200);
    const r = await call(A.cookie, "POST", `/content/${assetId}/export`);
    expect(r.statusCode).toBe(403); expect(r.json()).toMatchObject({ error: "consent_required", missingConsentFor: ["Asha Devi"] });
    expect(r.json().body).toBeUndefined();                       // the content itself is not leaked in the refusal
    expect((await call(A.cookie, "GET", `/content/${assetId}`)).json().status).toBe("approved"); // not exported
    expect((await rawDb.select().from(schema.securityEventLog).where(eq(schema.securityEventLog.action, "export_blocked_no_consent"))).length).toBe(1);
  });

  it("NEGATIVE: consent with the wrong scope (photo) does not unlock a story", async () => {
    await call(A.cookie, "POST", "/consents", { subjectName: "Asha Devi", scope: "photo", evidenceNote: "signed photo release 2025-01-10" });
    expect((await call(A.cookie, "POST", `/content/${assetId}/export`)).statusCode).toBe(403);
  });

  it("NEGATIVE + CROSS-TENANT: another org's consent for the same name does NOT unlock this org's asset", async () => {
    await call(B.cookie, "POST", "/consents", { subjectName: "Asha Devi", scope: "all", evidenceNote: "B's own record" });
    expect((await call(A.cookie, "POST", `/content/${assetId}/export`)).statusCode).toBe(403);
    expect((await call(B.cookie, "GET", "/consents")).json()).toHaveLength(1);
    expect((await call(A.cookie, "GET", "/consents")).json()).toHaveLength(1); // only A's own photo consent
  });

  it("POSITIVE: with an active story consent on file, export succeeds", async () => {
    await call(A.cookie, "POST", "/consents", { subjectName: "asha devi", scope: "story", evidenceNote: "signed story release 2025-01-10" });
    const r = await call(A.cookie, "POST", `/content/${assetId}/export`);
    expect(r.statusCode).toBe(200); expect(r.json().status).toBe("exported"); expect(r.json().body).toContain("Asha Devi");
  });

  it("NEGATIVE: consent REVOKED after approval blocks export again (checked at export time)", async () => {
    const second = (await gen(A.cookie, { topic: "Asha follow-up" })).json();
    await call(A.cookie, "POST", `/content/${second.id}/approve`);
    const story = (await call(A.cookie, "GET", "/consents")).json().find((c: { scope: string }) => c.scope === "story");
    expect((await call(A.cookie, "POST", `/consents/${story.id}/revoke`)).statusCode).toBe(200);
    expect((await call(A.cookie, "POST", `/content/${second.id}/export`)).statusCode).toBe(403);
  });

  it("export requires human approval first", async () => {
    const d = (await gen(A.cookie, { topic: "third draft" })).json();
    expect((await call(A.cookie, "POST", `/content/${d.id}/export`)).statusCode).toBe(409);
  });

  it("story kinds must explicitly declare beneficiaries or assert none; non-beneficiary assets export freely", async () => {
    expect((await call(A.cookie, "POST", "/content/generate", { kind: "case_study", topic: "Program overview", facts: ["We run 3 centres"] })).statusCode).toBe(400);
    const ok = (await call(A.cookie, "POST", "/content/generate", { kind: "case_study", topic: "Program overview", facts: ["We run 3 centres"], noBeneficiaryIdentified: true })).json();
    await call(A.cookie, "POST", `/content/${ok.id}/approve`);
    expect((await call(A.cookie, "POST", `/content/${ok.id}/export`)).statusCode).toBe(200);
  });

  it("CROSS-TENANT: org B cannot read, approve or export org A's assets", async () => {
    for (const [m, u] of [["GET", `/content/${assetId}`], ["POST", `/content/${assetId}/approve`], ["POST", `/content/${assetId}/export`]] as const) expect((await call(B.cookie, m, u)).statusCode, u).toBe(404);
    expect((await call(B.cookie, "GET", "/content")).json()).toHaveLength(0);
  });

  it("ROLE: viewers cannot generate, approve or export", async () => {
    await rawDb.update(schema.memberships).set({ role: "viewer" }).where(eq(schema.memberships.userId, A.userId));
    expect((await gen(A.cookie)).statusCode).toBe(403);
    expect((await call(A.cookie, "POST", `/content/${assetId}/export`)).statusCode).toBe(403);
    expect((await call(A.cookie, "GET", "/content")).statusCode).toBe(200);
    await rawDb.update(schema.memberships).set({ role: "owner" }).where(eq(schema.memberships.userId, A.userId));
  });

  it("no LLM configured => honest 501", async () => {
    const bare = await buildApp(); await bare.ready();
    const r = await bare.inject({ method: "POST", url: "/content/generate", headers: { cookie: A.cookie }, payload: { kind: "social_post", topic: "hello world", facts: ["x"] } });
    expect(r.statusCode).toBe(501); await bare.close();
  });
});

describe("anthropicProvider request shape (stubbed fetch; no live call was possible in the build sandbox)", () => {
  it("sends the documented Messages API request and parses text blocks", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ model: "m-1", content: [{ type: "text", text: "hello " }, { type: "text", text: "world" }] }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const out = await anthropicProvider("KEY", "m-1").complete({ system: "S", prompt: "P" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("KEY");
    expect((init.headers as Record<string, string>)["anthropic-version"]).toBe("2023-06-01");
    expect(JSON.parse(init.body as string)).toMatchObject({ model: "m-1", system: "S", messages: [{ role: "user", content: "P" }] });
    expect(out.text).toBe("hello world");
    vi.unstubAllGlobals();
  });
});

import { pseudonymize, restore } from "../src/content/consent.js";
describe("pseudonymize (pure)", () => {
  it("masks full names AND bare name parts, and restores them exactly", () => {
    const { text, map } = pseudonymize("Asha Devi joined. Asha's income rose; Devi said thanks. Ashagram is a place.", ["Asha Devi"]);
    expect(text).not.toMatch(/Asha\b|Devi\b/);
    expect(text).toContain("Ashagram");                       // word-boundary: doesn't mangle unrelated words
    expect(restore(text, map)).toBe("Asha Devi joined. Asha's income rose; Devi said thanks. Ashagram is a place.");
  });
});

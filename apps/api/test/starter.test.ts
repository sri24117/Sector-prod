import { beforeAll, afterAll, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { rawDb, pool, schema } from "@sector/db";
import { buildApp } from "../src/app.js";
import type { FastifyInstance } from "fastify";
import { pseudonymize, restore } from "../src/content/consent.js";
let app: FastifyInstance; let signupIp = 0;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await pool.query("TRUNCATE organizations, users CASCADE"); await app.close(); await pool.end(); });
async function org(tag: string, plan = "starter") {
  const r = await app.inject({ method: "POST", url: "/auth/signup", remoteAddress: `192.0.2.${++signupIp}`, payload: { name: "Coordinator", email: `${tag}@example.org`, password: "long-pilot-password", organizationName: tag } });
  await rawDb.update(schema.organizations).set({ plan }).where(eq(schema.organizations.id, r.json().organizationId));
  const cookie = r.cookies.find((c) => c.name === "sector_session")!;
  return { cookie: `${cookie.name}=${cookie.value}`, ...r.json() };
}
const draft = { kind: "social_post", title: "Program update", body: "Our program update is ready for review.", facts: ["Program brief, October: an update is ready"], beneficiaryRefs: [], noBeneficiaryIdentified: true };
const call = (cookie: string, method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: unknown) => app.inject({ method, url, headers: { cookie }, payload: payload as never });
it("manual draft → edit → approve → repeated export → calendar; stale edits are rejected", async () => {
  const a = await org("journey");
  const created = await call(a.cookie, "POST", "/content", draft); expect(created.statusCode).toBe(201); const asset = created.json();
  expect((await call(a.cookie, "POST", `/content/${asset.id}/approve`, { revision: 1 })).statusCode).toBe(200);
  for (let i = 0; i < 2; i++) expect((await call(a.cookie, "POST", `/content/${asset.id}/export`)).json().body).toBe(draft.body);
  const saved = await call(a.cookie, "PATCH", `/content/${asset.id}`, { ...draft, revision: 1, body: "A corrected program update." }); expect(saved.statusCode).toBe(200); expect(saved.json()).toMatchObject({ status: "draft", revision: 2 });
  expect((await call(a.cookie, "POST", `/content/${asset.id}/export`)).statusCode).toBe(409);
  expect((await call(a.cookie, "POST", `/content/${asset.id}/approve`, { revision: 1 })).statusCode).toBe(409);
  expect((await call(a.cookie, "PATCH", `/content/${asset.id}`, { ...draft, revision: 1 })).statusCode).toBe(409);
  const entry = { contentAssetId: asset.id, date: "2026-11-03", channel: "facebook", objective: "Explain program progress", assignee: "Coordinator" };
  expect((await call(a.cookie, "POST", "/calendar", { ...entry, date: "2026-02-30" })).statusCode).toBe(400);
  const planned = await call(a.cookie, "POST", "/calendar", entry); expect(planned.statusCode).toBe(201);
  expect((await call(a.cookie, "GET", "/calendar")).json()[0].status).toBe("draft");
  await call(a.cookie, "POST", `/content/${asset.id}/approve`, { revision: 2 });
  expect((await call(a.cookie, "GET", "/calendar")).json()[0].status).toBe("ready_to_post");
  expect((await call(a.cookie, "DELETE", `/calendar/${planned.json().id}`)).statusCode).toBe(204);
});
it("does not expose another NGO's drafts or calendar and enforces viewer/free limits", async () => {
  const a = await org("isolation-a"), b = await org("isolation-b"), free = await org("isolation-free", "free");
  const asset = (await call(a.cookie, "POST", "/content", draft)).json();
  const entry = { contentAssetId: asset.id, date: "2026-11-03", channel: "facebook", objective: "Explain progress", assignee: "Coordinator" };
  const planned = (await call(a.cookie, "POST", "/calendar", entry)).json();
  expect((await call(b.cookie, "POST", "/calendar", entry)).statusCode).toBe(404);
  expect((await call(b.cookie, "PATCH", `/content/${asset.id}`, { ...draft, revision: 1 })).statusCode).toBe(404);
  expect((await call(b.cookie, "DELETE", `/calendar/${planned.id}`)).statusCode).toBe(404);
  expect((await call(b.cookie, "GET", "/calendar")).json()).toEqual([]);
  expect((await call(free.cookie, "GET", "/calendar")).statusCode).toBe(403);
  await rawDb.update(schema.memberships).set({ role: "viewer" }).where(eq(schema.memberships.organizationId, a.organizationId));
  expect((await call(a.cookie, "POST", "/content", draft)).statusCode).toBe(403);
  expect((await call(a.cookie, "POST", "/calendar", entry)).statusCode).toBe(403);
  expect((await call(a.cookie, "GET", "/calendar")).statusCode).toBe(200);
});
it("limits concurrent draft creation to the Starter allowance", async () => {
  const a = await org("quota");
  const results = await Promise.all(Array.from({ length: 17 }, () => call(a.cookie, "POST", "/content", draft)));
  expect(results.filter((r) => r.statusCode === 201)).toHaveLength(15);
  expect(results.filter((r) => r.statusCode === 429)).toHaveLength(2);
});
it("revoked consent blocks both repeat export and calendar readiness", async () => {
  const a = await org("consent-calendar"), asset = (await call(a.cookie, "POST", "/content", { ...draft, body: "Li Na joined our program.", beneficiaryRefs: ["Li Na"] })).json();
  const consent = (await call(a.cookie, "POST", "/consents", { subjectName: "Li Na", scope: "story", evidenceNote: "Signed story permission" })).json();
  await call(a.cookie, "POST", `/content/${asset.id}/approve`, { revision: 1 });
  await call(a.cookie, "POST", "/calendar", { contentAssetId: asset.id, date: "2026-11-03", channel: "instagram", objective: "Program story", assignee: "Coordinator" });
  expect((await call(a.cookie, "POST", `/content/${asset.id}/export`)).statusCode).toBe(200);
  await call(a.cookie, "POST", `/consents/${consent.id}/revoke`);
  expect((await call(a.cookie, "POST", `/content/${asset.id}/export`)).statusCode).toBe(403);
  expect((await call(a.cookie, "GET", "/calendar")).json()[0].status).toBe("consent_required");
});
it("masks short names and restores them without mangling unrelated words", () => {
  const input = "Li Na joined. Li shared an update. Public library.";
  const hidden = pseudonymize(input, ["Li Na"]);
  expect(hidden.text).not.toMatch(/\bLi\b|\bNa\b/); expect(hidden.text).toContain("Public library"); expect(restore(hidden.text, hidden.map)).toBe(input);
});

import "../env.js";
import { eq } from "drizzle-orm";
import { rawDb, pool, scopedDb, schema } from "@sector/db";
import { hashPassword } from "../auth/password.js";

// DEMO DATA ONLY: one fictional NGO with a login, so every screen has something to show.
// Re-running replaces the previous demo org. Refuses to run in production unless forced,
// because it creates a known password. Usage: pnpm --filter @sector/api seed:demo
const EMAIL = "demo@sector.local";
const PASSWORD = "demo-password-2026";
const SITE = "https://example.org/";

if (process.env.NODE_ENV === "production" && !process.argv.includes("--allow-production")) {
  console.error("Refusing to seed a demo login in production (pass --allow-production to override).");
  process.exit(1);
}

const days = (n: number) => new Date(Date.now() - n * 86_400_000);

const [existing] = await rawDb.select().from(schema.users).where(eq(schema.users.email, EMAIL));
if (existing) {
  const ms = await rawDb.select().from(schema.memberships).where(eq(schema.memberships.userId, existing.id));
  for (const m of ms) await rawDb.delete(schema.organizations).where(eq(schema.organizations.id, m.organizationId));
  await rawDb.delete(schema.users).where(eq(schema.users.id, existing.id));
}

const [org] = await rawDb.insert(schema.organizations).values({ name: "Prakash Learning Trust (Demo)" }).returning();
const [user] = await rawDb.insert(schema.users).values({ email: EMAIL, name: "Kavya Iyer", passwordHash: await hashPassword(PASSWORD) }).returning();
await rawDb.insert(schema.memberships).values({ userId: user!.id, organizationId: org!.id, role: "owner" });
await rawDb.insert(schema.organizationProfiles).values({
  organizationId: org!.id, websiteUrl: SITE, fcraSelfDeclared: true, fcraConfirmedAt: days(20),
  fcraRegistrationNo: "DEMO-FCRA-0000", panNumber: "DEMO0000P",
});

const db = scopedDb(org!.id);

// Two audits of example.org (the real live result today scores 25), so history shows a trend.
const checks = (fresh: boolean) => [
  { checkId: "schema", weight: 20, passed: false, detail: "No relevant JSON-LD schema found" },
  { checkId: "robots_txt_ai_block", weight: 15, passed: true, detail: "No AI crawlers blocked in robots.txt" },
  { checkId: "llms_txt", weight: 5, passed: false, detail: "llms.txt not found" },
  { checkId: "heading_hierarchy", weight: 15, passed: false, detail: "Found 0 <h1>, 0 <h2>" },
  { checkId: "faq_pairs", weight: 20, passed: false, detail: "Found 0 FAQ-style Q&A pairs (target: 3-6)" },
  { checkId: "front_loaded_stat", weight: 15, passed: false, detail: "No concrete stat/figure found in the first 30% of content" },
  { checkId: "freshness", weight: 10, passed: fresh, detail: fresh ? "Last-Modified header present" : "No freshness signal found" },
];
for (const [ago, fresh] of [[14, false], [2, true]] as const) {
  const c = checks(fresh);
  const { audit } = await db.audits.create({ url: SITE, score: c.reduce((s, x) => s + (x.passed ? x.weight : 0), 0), runAt: days(ago), checks: c });
  await rawDb.update(schema.audits).set({ createdAt: days(ago) }).where(eq(schema.audits.id, audit.id));
}

await db.brandKit.upsert({ voice: "Warm, plain and specific. We talk about children and teachers by what they did, never as statistics or objects of pity. No exclamation marks." });

await db.consentRecords.create({ subjectName: "Meena Kumari", scope: "story", evidenceNote: "Signed release form, collected by field coordinator, 4 Aug 2026" });
const revoked = await db.consentRecords.create({ subjectName: "Ravi Shankar", scope: "all", evidenceNote: "Verbal consent recorded on call, 1 Jul 2026" });
await db.consentRecords.revoke(revoked.id);

await db.contentAssets.create({
  kind: "case_study", title: "Evening reading circles in Kanakapura", status: "approved", createdBy: user!.id, model: "demo-seed",
  beneficiaryRefs: ["Meena Kumari"],
  body: "When the evening reading circle started in Kanakapura, Meena Kumari was one of six volunteers. Twelve weeks later, 41 children were coming three evenings a week.\n\nThe circles run in a borrowed classroom from 6 to 7:30 pm, after farm work ends. Meena reads aloud first, then the older children read to the younger ones.",
});
await db.contentAssets.create({
  kind: "social_post", title: "Teacher training week", status: "approved", createdBy: user!.id, model: "demo-seed",
  beneficiaryRefs: ["Arjun Das"],
  body: "This week 18 government-school teachers joined our phonics workshop. Arjun Das, who teaches Class 2, said the sound cards were the first thing his students asked to keep.",
});
await db.contentAssets.create({
  kind: "social_post", title: "Library corner opens", status: "draft", createdBy: user!.id, model: "demo-seed", beneficiaryRefs: [],
  body: "Our 30th library corner opened on Monday in a single-room school near Ramanagara: 220 books in Kannada and English, chosen by the teachers.",
});

const account = await db.adGrantAccount.upsert("1234567890", "linked");
await db.complianceAlerts.createMany([
  { accountId: account.id, ruleId: "ctr_5pct", metric: "account_ctr_last_30d", metricValue: "3.8%", threshold: "5.0%", message: "Account click-through rate was 3.8% over the last 30 days. Google requires at least 5.0%." },
  { accountId: account.id, ruleId: "min_sitelinks", metric: "unique_sitelinks", metricValue: "1", threshold: "2", message: "Only 1 unique sitelink; at least 2 are required." },
]);

console.log(`Demo NGO ready: ${org!.name}\n  login: ${EMAIL}\n  password: ${PASSWORD}`);
await pool.end();

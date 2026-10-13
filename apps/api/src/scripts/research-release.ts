import "../env.js";
import { desc, eq } from "drizzle-orm";
import { rawDb, pool, schema } from "@sector/db";
import { releaseAudit } from "../lib/research-release.js";

// INTERNAL OPS ONLY. Releases a reviewed research audit so the organization can see it.
//   npm run research-release -- --list        audits waiting for review
//   npm run research-release -- <auditId>     release one
const [arg] = process.argv.slice(2);

if (arg === "--list") {
  const rows = await rawDb.select({ id: schema.researchAudits.id, org: schema.organizations.name, site: schema.researchAudits.siteUrl, overall: schema.researchAudits.overallScore, createdAt: schema.researchAudits.createdAt })
    .from(schema.researchAudits).innerJoin(schema.organizations, eq(schema.organizations.id, schema.researchAudits.organizationId))
    .where(eq(schema.researchAudits.status, "in_review")).orderBy(desc(schema.researchAudits.createdAt));
  for (const r of rows) console.log(`${r.id}  ${String(r.overall ?? "-").padStart(3)}  ${r.org}  ${r.site}  ${r.createdAt.toISOString()}`);
  if (rows.length === 0) console.log("No audits waiting for review.");
} else if (!arg) {
  console.error("usage: research-release <auditId>  |  research-release --list");
  process.exitCode = 1;
} else {
  const result = await releaseAudit(arg);
  console.log(result === "released" ? `Released ${arg}.` : result === "not_found" ? `No audit ${arg}.` : `Audit ${arg} is not in review, so it was not released.`);
  if (result !== "released") process.exitCode = 1;
}
await pool.end();

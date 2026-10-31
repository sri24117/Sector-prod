import "../env.js";
import { eq } from "drizzle-orm";
import { rawDb, pool, schema } from "@sector/db";
import { formatAudit } from "../lib/research-show.js";

// INTERNAL OPS ONLY, read-only. Prints one research audit so the owner can review it before releasing.
//   npm run research-show -- <auditId>
const [arg] = process.argv.slice(2);
if (!arg || arg.startsWith("-")) {
  console.error("usage: research-show <auditId>");
  process.exitCode = 1;
} else {
  const [audit] = await rawDb.select().from(schema.researchAudits).where(eq(schema.researchAudits.id, arg));
  if (!audit) { console.error(`No audit ${arg}.`); process.exitCode = 1; }
  else {
    const [org] = await rawDb.select({ name: schema.organizations.name }).from(schema.organizations).where(eq(schema.organizations.id, audit.organizationId));
    const findings = await rawDb.select().from(schema.researchFindings).where(eq(schema.researchFindings.auditId, audit.id));
    console.log(formatAudit(audit, findings, org?.name ?? "(unknown organization)"));
  }
}
await pool.end();

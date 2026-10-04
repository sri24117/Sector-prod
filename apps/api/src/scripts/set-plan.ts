import "../env.js";
import { eq } from "drizzle-orm";
import { rawDb, pool, schema } from "@sector/db";

// INTERNAL OPS ONLY (ADR-0006: manual invoicing). Sets an organization's plan after you
// have invoiced it and checked it is an NGO, CSR team, foundation or social enterprise.
//   npm run set-plan -- <organizationId> <free|pilot|paid>
//   npm run set-plan -- --list        organizations with plan, type and website
const [arg, plan] = process.argv.slice(2);
const PLANS = ["free", "pilot", "paid"];

if (arg === "--list") {
  const rows = await rawDb.select({ id: schema.organizations.id, name: schema.organizations.name, plan: schema.organizations.plan, type: schema.organizationProfiles.orgType, site: schema.organizationProfiles.websiteUrl })
    .from(schema.organizations).leftJoin(schema.organizationProfiles, eq(schema.organizationProfiles.organizationId, schema.organizations.id));
  for (const r of rows) console.log(`${r.id}  ${r.plan.padEnd(5)}  ${(r.type ?? "-").padEnd(17)}  ${r.name}  ${r.site ?? ""}`);
} else {
  if (!arg || !plan || !PLANS.includes(plan)) { console.error("usage: set-plan <organizationId> <free|pilot|paid>  |  set-plan --list"); process.exit(1); }
  const [org] = await rawDb.update(schema.organizations).set({ plan, updatedAt: new Date() }).where(eq(schema.organizations.id, arg)).returning();
  if (!org) { console.error(`No organization ${arg}`); await pool.end(); process.exit(1); }
  const [profile] = await rawDb.select().from(schema.organizationProfiles).where(eq(schema.organizationProfiles.organizationId, arg));
  console.log(`${org.name}: plan = ${org.plan} (type: ${profile?.orgType ?? "not given"}, website: ${profile?.websiteUrl ?? "none"})`);
}
await pool.end();

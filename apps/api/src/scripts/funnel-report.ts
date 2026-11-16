import "../env.js";
import { and, eq, gt, sql } from "drizzle-orm";
import { rawDb, pool, schema } from "@sector/db";
import { loadStarterPilotMetrics } from "../lib/starter-metrics.js";

// INTERNAL OPS ONLY. Phase 0-1 Goal #1: does the free audit convert to next steps?
//   pnpm --filter @sector/api funnel [days=30]
const days = Number(process.argv[2] ?? 30);
const since = new Date(Date.now() - days * 86_400_000);

const rows = await rawDb
  .select({ event: schema.funnelEvents.event, n: sql<number>`count(*)::int`, sites: sql<number>`count(distinct ${schema.funnelEvents.url})::int` })
  .from(schema.funnelEvents)
  .where(gt(schema.funnelEvents.createdAt, since))
  .groupBy(schema.funnelEvents.event);
const by = Object.fromEntries(rows.map((r) => [r.event, r]));
const n = (e: string) => by[e]?.n ?? 0;
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "n/a");

const audits = n("audit_run");
const intent = n("fix_clicked") + n("connect_cta_clicked");
const signups = n("signup_from_audit");
console.log(`Free-audit funnel, last ${days} days`);
console.log(`  audits run            ${audits}  (${by.audit_run?.sites ?? 0} distinct sites)`);
console.log(`  fix / connect clicks  ${intent}  connect-intent rate ${pct(intent, audits)}`);
console.log(`  signups from an audit ${signups}  audit-to-signup ${pct(signups, audits)}`);

const firstAudits = await rawDb.select({ n: sql<number>`count(distinct ${schema.audits.organizationId})::int` }).from(schema.audits)
  .innerJoin(schema.funnelEvents, and(eq(schema.funnelEvents.organizationId, schema.audits.organizationId), eq(schema.funnelEvents.event, "signup_from_audit")))
  .where(gt(schema.funnelEvents.createdAt, since));
console.log(`  of those, ran an audit inside the app  ${firstAudits[0]?.n ?? 0}`);

const pilot = await loadStarterPilotMetrics(pool);
console.log(`\nPilot, all time (${pilot.organizations} organizations, demo excluded)`);
console.log(`  audited / connected WordPress   ${pilot.auditedOrganizations} / ${pilot.wordpressConnectedOrganizations}  connect rate ${pct(pilot.wordpressConnectedOrganizations, pilot.auditedOrganizations)}`);
console.log(`  fixes verified / attempted      ${pilot.verifiedFixes} / ${pilot.remediationAttempts}  ${pct(pilot.verifiedFixes, pilot.remediationAttempts)}`);
console.log(`  average score change per fix    ${pilot.averageScoreChange === null ? "n/a (no verified fixes yet)" : `${pilot.averageScoreChange > 0 ? "+" : ""}${pilot.averageScoreChange} points`}`);
console.log(`  full reports finished           ${pilot.finishedReports}`);
console.log(`  content created / approved / exported  ${pilot.contentCreated} / ${pilot.contentApproved} / ${pilot.contentExported}`);
console.log(`  calendar items                  ${pilot.calendarItems}`);
console.log(`  active organizations, 7 days   ${pilot.activeOrganizationsLast7Days}`);
console.log(`  North Star outcomes, 7 days    ${pilot.outcomeOrganizationsLast7Days}`);
console.log(`  activated Starter organizations ${pilot.activatedStarterOrganizations}`);
console.log(`  plans                           free ${pilot.plans.free}, starter ${pilot.plans.starter}, growth ${pilot.plans.growth}, pro ${pilot.plans.pro}`);
await pool.end();

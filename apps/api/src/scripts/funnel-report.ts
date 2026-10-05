import "../env.js";
import { and, eq, gt, sql } from "drizzle-orm";
import { rawDb, pool, schema } from "@sector/db";

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

// The four numbers to check weekly during the pilot (all time, demo organizations excluded).
const real = `select id from organizations where name not ilike '%(demo)%'`;
const one = async (q: string) => Number((await pool.query(q)).rows[0]?.n ?? 0);
const orgs = await one(`select count(*) n from (${real}) o`);
const audited = await one(`select count(distinct organization_id) n from audits where organization_id in (${real})`);
const connected = await one(`select count(distinct organization_id) n from platform_connections where status = 'connected' and organization_id in (${real})`);
const attempted = await one(`select count(*) n from remediation_logs where platform = 'wordpress' and organization_id in (${real})`);
const verified = await one(`select count(*) n from remediation_logs where status = 'verified' and organization_id in (${real})`);
const delta = (await pool.query(`select round(avg(after_score - before_score), 1) d from remediation_logs where status = 'verified' and before_score is not null and after_score is not null and organization_id in (${real})`)).rows[0]?.d;
const plans = (await pool.query(`select plan, count(*)::int n from organizations where id in (${real}) group by plan order by plan`)).rows as { plan: string; n: number }[];
const plan = (p: string) => plans.find((r) => r.plan === p)?.n ?? 0;
console.log(`\nPilot, all time (${orgs} organizations, demo excluded)`);
console.log(`  audited / connected WordPress   ${audited} / ${connected}  connect rate ${pct(connected, audited)}`);
console.log(`  fixes verified / attempted      ${verified} / ${attempted}  ${pct(verified, attempted)}`);
console.log(`  average score change per fix    ${delta == null ? "n/a (no verified fixes yet)" : `${Number(delta) > 0 ? "+" : ""}${delta} points`}`);
console.log(`  plans                           paid ${plan("paid")}, pilot ${plan("pilot")}, free ${plan("free")}`);
await pool.end();

import type { Pool } from "@sector/db";
import { normalizePlan, type Plan } from "@sector/shared/plans";

export interface StarterPilotMetrics {
  organizations: number;
  plans: Record<Plan, number>;
  auditedOrganizations: number;
  wordpressConnectedOrganizations: number;
  remediationAttempts: number;
  verifiedFixes: number;
  averageScoreChange: number | null;
  finishedReports: number;
  contentCreated: number;
  contentApproved: number;
  contentExported: number;
  calendarItems: number;
  activeOrganizationsLast7Days: number;
  outcomeOrganizationsLast7Days: number;
  activatedStarterOrganizations: number;
}

type MetricRow = {
  organizations: number;
  audited_organizations: number;
  wordpress_connected_organizations: number;
  remediation_attempts: number;
  verified_fixes: number;
  average_score_change: string | null;
  finished_reports: number;
  content_created: number;
  content_approved: number;
  content_exported: number;
  calendar_items: number;
  active_organizations_7d: number;
  outcome_organizations_7d: number;
  activated_starter_organizations: number;
};

/**
 * Internal pilot telemetry derived only from product tables. A demo organization
 * is excluded everywhere, so weekly numbers cannot be inflated by screenshots
 * or sales demos. "Activated" means an exported piece or verified WordPress fix
 * within 14 days after a paid Starter request was activated.
 */
export async function loadStarterPilotMetrics(client: Pick<Pool, "query">, now = new Date()): Promise<StarterPilotMetrics> {
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const result = await client.query<MetricRow>(`
    with real_orgs as (
      select id, plan from organizations where name not ilike '%(demo)%'
    ), recent_activity as (
      select organization_id from reports where status = 'done' and finished_at >= $1
      union select organization_id from content_assets where created_at >= $1
      union select organization_id from calendar_items where created_at >= $1
      union select organization_id from remediation_logs where status = 'verified' and created_at >= $1
    ), recent_outcomes as (
      select organization_id from content_assets where status = 'exported' and created_at >= $1
      union select organization_id from remediation_logs where status = 'verified' and created_at >= $1
    )
    select
      (select count(*)::int from real_orgs) organizations,
      (select count(distinct organization_id)::int from audits where organization_id in (select id from real_orgs)) audited_organizations,
      (select count(distinct organization_id)::int from platform_connections where provider = 'wordpress' and status = 'connected' and organization_id in (select id from real_orgs)) wordpress_connected_organizations,
      (select count(*)::int from remediation_logs where platform = 'wordpress' and organization_id in (select id from real_orgs)) remediation_attempts,
      (select count(*)::int from remediation_logs where platform = 'wordpress' and status = 'verified' and organization_id in (select id from real_orgs)) verified_fixes,
      (select round(avg(after_score - before_score), 1)::text from remediation_logs where platform = 'wordpress' and status = 'verified' and before_score is not null and after_score is not null and organization_id in (select id from real_orgs)) average_score_change,
      (select count(*)::int from reports where status = 'done' and organization_id in (select id from real_orgs)) finished_reports,
      (select count(*)::int from content_assets where organization_id in (select id from real_orgs)) content_created,
      (select count(*)::int from content_assets where status in ('approved', 'exported') and organization_id in (select id from real_orgs)) content_approved,
      (select count(*)::int from content_assets where status = 'exported' and organization_id in (select id from real_orgs)) content_exported,
      (select count(*)::int from calendar_items where organization_id in (select id from real_orgs)) calendar_items,
      (select count(distinct organization_id)::int from recent_activity where organization_id in (select id from real_orgs)) active_organizations_7d,
      (select count(distinct organization_id)::int from recent_outcomes where organization_id in (select id from real_orgs)) outcome_organizations_7d,
      (select count(distinct pr.organization_id)::int
         from plan_requests pr
        where pr.status = 'activated' and pr.plan = 'starter'
          and pr.organization_id in (select id from real_orgs)
          and (
            exists (select 1 from content_assets ca where ca.organization_id = pr.organization_id and ca.status = 'exported' and ca.created_at between pr.updated_at and pr.updated_at + interval '14 days')
            or exists (select 1 from remediation_logs rl where rl.organization_id = pr.organization_id and rl.status = 'verified' and rl.created_at between pr.updated_at and pr.updated_at + interval '14 days')
          )) activated_starter_organizations
  `, [since]);

  const row = result.rows[0]!;
  const planRows = await client.query<{ plan: string; n: number }>(
    "select plan, count(*)::int n from organizations where name not ilike '%(demo)%' group by plan",
  );
  const plans: Record<Plan, number> = { free: 0, starter: 0, growth: 0, pro: 0 };
  for (const planRow of planRows.rows) plans[normalizePlan(planRow.plan)] += planRow.n;

  return {
    organizations: row.organizations,
    plans,
    auditedOrganizations: row.audited_organizations,
    wordpressConnectedOrganizations: row.wordpress_connected_organizations,
    remediationAttempts: row.remediation_attempts,
    verifiedFixes: row.verified_fixes,
    averageScoreChange: row.average_score_change === null ? null : Number(row.average_score_change),
    finishedReports: row.finished_reports,
    contentCreated: row.content_created,
    contentApproved: row.content_approved,
    contentExported: row.content_exported,
    calendarItems: row.calendar_items,
    activeOrganizationsLast7Days: row.active_organizations_7d,
    outcomeOrganizationsLast7Days: row.outcome_organizations_7d,
    activatedStarterOrganizations: row.activated_starter_organizations,
  };
}

# Slice 4 — Ad Grants claim + compliance monitor

**Built:** `@sector/ad-grants` — deterministic evaluator for the rules in `skills/ad-grants.md` §4 (5% CTR incl. two-consecutive-months, Quality Score 1-2, conversion tracking with vanity-metric exclusion, Smart Bidding, structure minimums, single-word keywords, $2 CPC cap **only** on Manual CPC/Maximize Clicks; legacy pre-22-Apr-2019 accounts exempt). Every alert cites rule + metric + value + threshold. Daily BullMQ sweep (03:00) in `services/workers`. Routes `/ad-grants/*`. Web UI `/ad-grants`.

**Decisions taken (skill §7 says these are founder decisions — override if you disagree):**
- **Alert-only, no auto-remediation.** The system never mutates a client's Google Ads account.
- **FCRA "confirmed" ≠ self-declared.** Gate is `fcraConfirmedAt`, set only by internal ops: `pnpm --filter @sector/db confirm-fcra <organizationId>`. No org-facing route can set it. The gate runs first in every route and inside the runner/scheduler (not a UI hide); denial copy is neutral (no teasing).
- Deliberately absent: the "90-day inactivity" rule and any high-CPC flag on Smart Bidding accounts (both called out as false positives in the skill), and "Limited Ad Serving" (unconfirmed).

## Verified
17 package tests + 5 API tests (real Postgres): each rule, the two false-positive guards, legacy exemption, FCRA gate (self-declared-only org refused on every route, gateway never called, nothing written), cross-tenant, viewer role, re-run resolves fixed alerts, sweep skips unconfirmed orgs and isolates per-org failures. Real Redis: worker boots, scheduler registered, a job enqueued through BullMQ was processed and honestly reported `failed=1` (gateway unavailable).

## NOT possible yet — external gate
**Live data.** Google Ads API access (Explorer/Basic) must be granted first (file in week one — see `integrations.md`). Until then the production gateway is `unavailableGateway`: routes return 501, the sweep reports failures — it never fabricates numbers. To go live: implement `GoogleAdsGateway.fetchSnapshot` with the GAQL fields in skill §5 and inject it in `apps/api/src/index.ts` and the worker. The evaluator was tested against fixture snapshots, not real GAQL output; field mapping is unverified until then.

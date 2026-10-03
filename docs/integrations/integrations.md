# SEctOr — Integrations & Gate Status

Living tracker. Update the Status column as applications are filed/cleared —
this is the "one external-dependency tracker" the master spec calls for, so
gate status is visible to the whole team, not buried in one skill's thread.

| Provider | Connector | Gate type | Realistic timeline | Status | Skill(s) |
|---|---|---|---|---|---|
| Google Ads API | `packages/connectors/google-ads` | Brand verification then tiered review (Explorer/Basic/Standard); access model changed 10 Sept 2026 | Hours-10 business days | NOT STARTED | 7 |
| Google Search Console | `packages/connectors/search-console` | Standard OAuth, no partner review | Immediate | NOT STARTED | 1, 2 |
| Google Analytics (GA4) | `packages/connectors/google-analytics` | Standard OAuth | Immediate | NOT STARTED | analytics |
| Meta (Instagram + Facebook) | `packages/connectors/meta` | App Review + Business Verification per permission | Days-weeks, unpredictable stalls | NOT STARTED | 3 |
| LinkedIn Community Management API | `packages/connectors/linkedin` | Discretionary Standard Tier approval, screencast review | 3-4 months | NOT STARTED — **file in week one, highest-risk item in the whole build** | 3 |
| YouTube (sensitive-scope OAuth) | `packages/connectors/youtube` | Google trust & safety review | Unconfirmed; unverified apps capped at 100 channels regardless | NOT STARTED | 3 |
| X (Twitter) | `packages/connectors/x` | None (pay-per-use) | Immediate, but real linear cost — price it in | NOT STARTED | 3 |
| Goodstack (Ad Grants verification) | n/a (manual tracking, no confirmed status-check API) | N/A | N/A | Track per-client status manually; separately ask Goodstack whether a partner-tier API exists | 7 |
| Browserless.io (headless render) | `services/crawler` | Commercial account, no approval process | Immediate | NOT STARTED | 1 |
| Canva Connect API | n/a — deferred | Enterprise plan required on both SEctOr and every client NGO | N/A, purchasing decision | DEFERRED — see ADR and skills/brand-visual-designer.md | 5 |
| Wix App Market listing | `packages/connectors` (future) | App review, timeline unconfirmed | Unconfirmed | NOT STARTED | 2 |
| Webflow robots.txt API | n/a | Enterprise-plan-only | N/A | Manual fallback assumed permanently for non-Enterprise clients | 2 |
| Razorpay (billing/payments) | `packages/connectors/razorpay` (not yet created) | Business KYC (bank account + registration docs), no partner-approval review | Typically 1-5 business days once docs submitted, can stall on document mismatches | NOT STARTED — **blocked on ADR-0006 being confirmed first** (manual-invoicing alternative may make this row moot for the 5-NGO pilot) | n/a — billing, not a skill |

## Rule

Nothing in `docs/product/product.md` or client-facing copy promises a
capability whose row above is not at least "cleared." A gate in "NOT
STARTED" or "pending" is a tracked dependency, not a hidden assumption.

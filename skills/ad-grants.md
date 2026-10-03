# Skill 7: Google Ad Grants Claim and Compliance Agent

Status: it is also, per the differentiation work already agreed with the founder, the moat: standing, autonomous, persistent monitoring of a live connected Ad Grants account is the one thing a chat session structurally cannot do.

## 1. Role and scope

Two jobs, sequenced: (1) help a client NGO get from "not on Google Ad Grants" to "verified and running" (claim), and (2) once running, continuously monitor the account against every Ad Grants compliance rule and either alert or (with the client's prior authorization) directly fix a violation before Google suspends the account (compliance). FCRA-gated: this feature must never activate, teaser, or render for an org whose FCRA status isn't confirmed true, per the trust-protecting decision already made in the Phase 1 spec.

## 2. Critical, time-sensitive finding: the Google Ads API access model changed one week before this spec was written

Google fundamentally changed how API access works on **10 September 2026**, developer tokens as the access-control mechanism are being phased out in favor of Google Cloud project-based access. Anything the dev team finds elsewhere dated before mid-2026 describing "developer token tiers" is describing the old model. This is genuinely new and still stabilizing; re-verify against `developers.google.com/google-ads/api/docs/api-policy/access-levels` immediately before scoping engineering work, not just before launch.

Current tiers under the new model:

| Tier | Access | Daily operation limit | Path to get it |
|---|---|---|---|
| Test | Test accounts only | 15,000 ops/day | Default |
| **Explorer** (new, launched Feb 2026) | Test + limited production | 2,880 ops/day production | Requires brand verification on the Cloud project (OAuth consent screen set to External + In Production, with branding/privacy-policy/logo), takes "a few minutes" once the project itself is ready |
| Basic | Test + production | 15,000 ops/day | Brand verification, then reviewed in hours if brand verification is done, up to ~5 business days if not |
| **Standard** | Effectively unlimited daily ops | Manual compliance review (functionality, target audience/use case, requires a demo/screen-share with Google), ~10 business days |

**Recommended sequencing**: prototype and onboard the first NGO clients on Explorer or Basic (sufficient for a small pilot cohort), and apply for Standard once client count and polling frequency make the 15,000 ops/day ceiling a real constraint (daily GAQL polling across dozens/hundreds of accounts plus mutate calls for auto-remediation will get there faster than it sounds). List every managed client account under the signup Manager account before applying, Google explicitly says this speeds review.

## 3. Manager account (MCC) structure: not a simple OAuth flow

This is a two-sided, explicit invitation/acceptance model, distinct from and in addition to SEctOr's own OAuth setup for calling the API at all:

1. SEctOr's MCC initiates a link to the client's Ad Grants account (`CustomerClientLinkService.MutateCustomerClientLink`, status `PENDING`), or does this manually in the Ads UI.
2. **The client account must explicitly accept**, a human at the NGO clicking "Accept" in their Google Ads UI, or the client's own credentials confirming via `CustomerManagerLinkService.MutateCustomerManagerLink`.
3. Only after acceptance can SEctOr's linked credentials read/write that account.

**Product implication**: every one of potentially hundreds of NGO clients needs one explicit, manual acceptance step, and most small-NGO admins will not know what an "MCC invitation" means. Build a guided onboarding checklist/email specifically for this step, it is a real friction point, not a technicality to wave away.

## 4. Compliance rules to monitor, confirmed current as of this research

| Rule | Status | Detail |
|---|---|---|
| 5% account-level CTR minimum | Confirmed, unchanged | Two consecutive months below 5% triggers temporary deactivation |
| Minimum Quality Score | Confirmed | Keywords at QS 1-2 must be paused/removed |
| Conversion tracking | Confirmed, mandatory for accounts created after 22 Apr 2019 | At least one meaningful conversion action, at least 1 conversion/month; vanity metrics like time-on-site don't count |
| Mandatory Smart Bidding | Confirmed, still mandatory for accounts created after 22 Apr 2019 | Maximize Conversions, Maximize Conversion Value, Target CPA, or Target ROAS, manual CPC is non-compliant for these accounts |
| Minimum account structure | Confirmed | ≥2 ad groups/campaign, ≥2 unique sitelinks, no single-word keywords |
| **"90-day inactivity" rule** | **Likely does not exist as commonly stated, do not build around it.** The actual documented Google-Ads-wide policy is 15 months of no spend before auto-cancellation (a general policy, not Grants-specific). Real Grants inactivity risk comes from the CTR and monthly-conversion rules above, not a standalone 90-day clock. | Drop this from the compliance-checker logic; it was carried in an earlier round of the spec and has been corrected. |
| $2/keyword CPC cap | Confirmed to exist but narrowly scoped | Applies only to Manual CPC/Maximize Clicks strategies. Since Smart Bidding is mandatory for modern accounts and isn't subject to this cap, a correctly configured account can and should show CPCs well above $2, **do not flag high CPCs as a violation on a compliant Smart-Bidding account**; this is an easy false-positive to build by accident. |
| "Limited Ad Serving" policy expansion | Reported by a third-party consultancy, not independently confirmed against a primary Google announcement | Plausible, reportedly rolling out from June 2026, throttling impressions (rather than suspending) for advertisers lacking clear trust/transparency signals. Flag for direct verification against Google's own Ads Help announcements page before building a related check, do not ship a compliance rule based on unconfirmed third-party reporting. |

## 5. Reporting mechanism: GAQL, unaffected by the September access-model change

Google Ads Query Language remains the reporting mechanism via `GoogleAdsService.Search`/`SearchStream`. A daily/weekly compliance query needs, per client account: `metrics.ctr` at customer level over a rolling 30-day window (the 5% rule), `ad_group_criterion.quality_info.quality_score` at keyword level (the QS rule), `metrics.conversions`/`metrics.all_conversions` plus `conversion_action.category`/`type` (the monthly-conversion rule, filtering out non-qualifying types), `campaign.bidding_strategy_type` (to confirm Smart Bidding compliance and correctly gate the CPC-cap check), and ad group/sitelink/keyword counts for the structural minimums.

## 6. Verification partner (Goodstack): do not assume a status-check API exists

Goodstack does publish a real developer API for nonprofit verification (Search Organisations, Create Validation Submission, webhook subscriptions), but this is Goodstack's general-purpose verification-as-a-service product for third-party platforms, and there is **no confirmed evidence it is the same integration Google uses for Google for Nonprofits/Ad Grants eligibility specifically**. The documented India-specific flow remains manual: apply via Google for Nonprofits, Goodstack emails the org, review in 3-5 working days, no self-service status portal mentioned on Google's side.

**Recommendation**: do not architect around an assumed live status-check API. Track verification status as a manually-updated field per client (fed by staff checking the org's own Goodstack/Google email correspondence), and separately reach out to Goodstack directly to ask whether a partner-tier integration exists, this is a real open question worth a direct conversation, not something to resolve by reading docs further.

## 7. What is buildable on day one vs. what needs a later decision

**Buildable now**: the GAQL-based compliance monitor (once Explorer/Basic access is granted), the guided MCC-invitation onboarding flow, the corrected compliance rule set above (with the 90-day rule removed and the CPC-cap false-positive fixed).

**Gated, file in week one**: the developer/API access application, filed under the Sept 2026 Explorer/Basic/Standard model.

**Decide now**: whether auto-remediation (SEctOr's system directly adjusting a client's live campaign, e.g., pausing a low-QS keyword) ships in Phase 1 at all, or whether Phase 1 ships alert-only ("here's what's wrong, here's the fix, click to apply") with direct auto-fix deferred. Given the trust sensitivity already established around this feature (FCRA-gating, no teasing a benefit an org can't access) and the fact that a live account is real money and real compliance risk for the NGO, the more conservative "alert plus one-click apply" model is the safer Phase 1 scope, full silent auto-remediation is a stronger version of the moat but a materially higher trust and liability bar, and should be a deliberate founder decision, not a default the dev team backs into.

## 8. Guardrails

- Never activate any part of this skill, including read-only monitoring, for an org whose FCRA status is not confirmed true.
- Every compliance alert must cite the specific rule and the specific metric value that triggered it, no black-box "your account has issues" messaging, given how much trust this feature requires from an NGO handing over live account access.

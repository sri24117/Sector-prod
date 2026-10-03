# Skill 3: Social Media Content Calendar

> **Reconstruction note**: rebuilt from a detailed working summary after the
> original session's local workspace was reset. If a byte-for-byte original
> copy exists on the founder's side, treat that as canonical.

Status: plans, schedules, and risk-manages organic social across LinkedIn, Instagram, Facebook, YouTube, and X, for donor showcase and outreach.

## 1. Role and scope

Content calendar generation, scheduling, organic-boosting tactics, and a risk register per platform. Does not itself write the post copy (that's a shared surface with Skill 4) — it plans, schedules, publishes, and tracks.

## 2. Platform-by-platform gating (see also `docs/integrations/integrations.md`, kept current there)

| Platform | Gate | Realistic timeline | Risk |
|---|---|---|---|
| LinkedIn Community Management API | Discretionary Standard Tier approval, screencast review, LinkedIn may reject at its own discretion | 3-4 months | **Highest-risk single item across every skill.** File in week one. Do not promise LinkedIn scheduling at launch. |
| Meta (Instagram + Facebook) | App Review + Business Verification per permission | Days to weeks per cycle, unpredictable stalls reported | Budget for rejection/resubmission cycles |
| YouTube | Sensitive-scope OAuth, Google trust & safety review | Unconfirmed timeline; unverified apps hard-capped at 100 channels regardless of review outcome | A real ceiling on growth for this platform specifically, not just a launch-timing issue |
| X (Twitter) | None (pay-per-use) | Immediate | Real, linear, per-post cost — must be priced into the product, not treated as a zero-cost channel |

## 3. Aggregator alternative

Ayrshare is a pragmatic alternative to clearing every platform approval independently, but it is **unconfirmed whether its existing approvals extend to cover a reseller's end-clients** (i.e. whether SEctOr publishing on behalf of many NGOs is actually covered, or each NGO still needs its own clearance underneath Ayrshare). See `docs/decisions/ADR-0004-social-scheduling-path.md` — this is an open decision, not resolved.

## 4. Risk register (new relative to the existing marcomm toolkit)

- **Platform policy risk**: rules change without notice (see LinkedIn/Meta review unpredictability above).
- **Consent/imagery risk**: any beneficiary-identifying photo requires a `ConsentRecord` before it can go into a scheduled post — shared gate with Skill 4.
- **Account-loss risk**: a suspended client account (e.g. from an Ad Grants or platform-policy violation) can take social reach down with it; don't assume platforms are independent failure domains for a given org.
- **Boosting/paid-promotion risk**: organic-boosting tactics must not silently cross into paid promotion without the client's explicit budget approval.

## 5. What ships in v1

**Buildable now, no external gate**: X and YouTube publishing (subject to the 100-channel cap), the full risk-register and consent-gate logic, calendar planning/drafting itself (independent of which platforms are live).

**Ships once its gate clears**: LinkedIn (3-4 months), Instagram/Facebook (weeks, unpredictable).

## 6. Data model

`ConsentRecord` (shared with Skill 4), `CalendarItem`, `ContentAsset`, `PlatformConnection` (per org, per platform, connection + gate status).

## 7. Success metric

Actual publish success rate per platform, not scheduled-vs-published — the real API failure modes documented above make this distinction matter.

# SEctOr — Phase 0-1 Vertical Slice Roadmap

> **Build status (all five slices implemented; see each feature-spec for what is and is NOT verified):**
> Slice 1 done · Slice 2 done · Slice 3 done, but the WordPress PHP plugin is untested on real WordPress · Slice 4 done against fixtures, live data blocked on Google Ads API access · Slice 5 done, no live LLM call made and vendor still undecided. Specs: `feature-spec-slice{1-audit-funnel-v1,2-org-onboarding-auth,3-remediation,4-ad-grants,5-content-consent}.md`.


Do not implement these in parallel. Each slice should travel through the
real system end to end before starting the next. Every slice below runs
through the full EXPLORE → PLAN → (HUMAN GATE for anything touching auth,
tenant isolation, or an external write) → BUILD → TEST → REVIEW → VERIFY →
SHIP cycle from `CLAUDE.md` / the AI Architecture Protocol — none of this
roadmap should be built by skipping straight from idea to code.

## Slice 1 — Audit funnel (the example the founder's own protocol names)

**NGO URL → crawl → extract → profile → audit → findings → shown to user**

- Objective: prove the free-audit funnel end to end, on real infrastructure,
  with the already-validated Skill 1 checks.
- Capabilities: `apps/web` URL-entry form, `apps/api` job enqueue,
  `services/crawler` running the 7 checks against a live site (via cheerio;
  Browserless.io fallback for JS-dependent sites per ADR-0003), Postgres
  `Audit`/`Finding` storage, results page.
- Dependencies: none external beyond Browserless.io (no approval gate).
- Exit criteria: a real NGO URL can be audited end-to-end and the score
  matches manual verification; connect-intent CTA is in place and
  instrumented (even if the "connect" step itself isn't built yet).
- Risks: JS-detection heuristic false-negatives (treating a JS-heavy site as
  static and getting a garbage crawl) — test against a deliberately
  JS-rendered fixture before calling this done.

## Slice 2 — Organization onboarding + auth

- Objective: an NGO can create an account, self-declare FCRA/PAN/12A/80G,
  and staff can log in with role-scoped access.
- Capabilities: `User`/`Organization`/`Membership` tables, auth per
  ADR-0005, brand-voice intake worksheet (reuse the existing
  `ngo-marcomm-toolkit` intake pattern).
- Dependencies: ADR-0005 must be CONFIRMED first (human gate).
- Exit criteria: two organizations' staff cannot see each other's data —
  test this explicitly, not just the happy path.

## Slice 3 — Remediation (the moat)

**Audit finding → proposed fix → applied fix (WordPress first) → re-crawl → RemediationLog**

- Objective: prove "execution instead of advice" on the one CMS that's
  buildable-now-no-gate (WordPress, via Application Passwords — see
  `skills/seo-geo-aio-implementor.md`).
- Dependencies: Slice 1 must exist (need an audit to remediate against).
- Exit criteria: a real fix (e.g. missing JSON-LD schema) applied to a test
  WordPress site is verifiably live and the before/after score is recorded.
- Explicitly deferred to a later slice: Wix/Webflow fixes (app-review gated),
  Squarespace (manual-only, disclose plainly per the founder's own
  no-half-finished-work standard).

## Slice 4 — Ad Grants claim + compliance monitor

- Objective: an FCRA-confirmed org can be guided through MCC linking and see
  a real compliance dashboard.
- Dependencies: Google Ads API access (Explorer/Basic tier) must be granted —
  file this application in week one, independent of engineering progress on
  this slice.
- Exit criteria: GAQL-based compliance query runs on a schedule and produces
  an alert that cites the specific rule and metric that triggered it (per
  the founder's own no-black-box-alerts guardrail in
  `skills/ad-grants.md`).

## Slice 5 — Content generation (Skill 4) + brand visuals (Skill 5)

- Objective: staff can request a case study or social post and get a
  brand-aligned draft, gated by `ConsentRecord` where a beneficiary is named
  or shown.
- Dependencies: `BrandKit` model, `ConsentRecord` model (build once, shared
  with Skill 3).
- Exit criteria: a generated asset referencing a beneficiary cannot be
  exported/published without a `ConsentRecord` on file — test this as a
  negative case, not just confirm the happy path works.

## Explicitly out of scope for Phase 0-1 (do not silently pull forward)

LinkedIn/Instagram/Facebook publishing (partner-approval gated, track in
`docs/integrations/integrations.md`), Canva-based generation (deferred,
ADR pending), full multi-country support (India-first is confirmed), a
general recommendation engine on top of the Experience Ledger (needs
reliable evidence first).

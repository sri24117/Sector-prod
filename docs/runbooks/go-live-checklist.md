# Go-live checklist: 0 → 5 pilot NGOs

Ordered by what actually blocks what, not by how interesting it is to build.
"Blocking" = can't take real money / real NGO data without it. "Parallel" =
start now, doesn't gate the others. "Deferred" = explicitly not needed for
5 NGOs — resist building these, see the bottom of this file.

## Phase 0 — Before touching another feature (BLOCKING)

- [ ] **Independent review pass** on auth, tenant isolation, and the
      schema/migrations — the one process gap from the last audit. Per
      `docs/methodology/AI_ENGINEERING_HANDYBOOK.md` §16, this is "most
      valuable for: Authentication, Payments, Database migrations,
      Multi-tenancy" — all of which were built and reviewed by the same
      session. Use a fresh session/reviewer, fill in
      `docs/templates/review-report.md` for real, fix what it finds.
- [ ] **Install the WordPress companion plugin on a real staging WordPress
      site.** It has never run on real WordPress — only against a mock
      server. Confirm: Application-Password auth reaches `/sector/v1/*`,
      the schema option persists, JSON-LD actually appears in page source.
      This is the real-world half of Slice 3's exit criterion and the
      single highest-risk unverified thing in the build.

## Phase 1 — Legal minimum (BLOCKING — don't collect real org data without this)

Signup already collects FCRA/PAN/12A/80G numbers; remediation stores
encrypted WordPress credentials. None of this should go live without:

- [ ] A **Privacy Policy** (what's collected, why, how long retained, who
      can see it).
- [ ] **Terms of Service** — critically, language that "FCRA self-declared"
      is exactly that, not a verification SEctOr performs or guarantees.
- [ ] A **DPDP Data Processing Addendum** — `PROJECT.md` already flags this
      as a founder/legal task, not an engineering one. Nothing here was
      built because nothing here is code.

## Phase 2 — Billing decision (BLOCKING for "sellable")

ADR-0006 is still open. For 0→5 NGOs specifically:

- [ ] Decide manual invoicing vs. Razorpay. **Manual is the honest
      recommendation at this scale** — zero new code, zero KYC wait, real
      rupees possibly this week. Razorpay solves a volume problem 5
      accounts don't have yet.
- [ ] If manual: add a `billingStatus` enum to `Organization`
      (`trial`/`invoiced`/`paid`/`overdue`), set by you, not a webhook.
      Small, fast, not built yet.
- [ ] Actually decide a price. Nothing is drafted anywhere in this repo —
      genuine open gap, not an oversight.

## Phase 3 — Infrastructure (BLOCKING, can run in parallel with Phase 1/2)

- [ ] Provision the VPS per ADR-0003 (4 vCPU / 16 GB / 200 GB / 16 TB).
- [ ] Domain + DNS + TLS via `infra/Caddyfile`.
- [ ] Populate `.env` on the server from `.env.example` — in particular
      generate `CREDENTIAL_ENCRYPTION_KEY` once (`openssl rand -base64 32`)
      and **back it up outside the server**; losing it makes every stored
      WordPress connection unreadable, with no recovery path.
- [ ] Confirm the Browserless.io tier (ADR-0003 is still PROPOSED). Without
      it, JS-heavy NGO sites will under-score — the audit UI already
      discloses this, but decide if that's acceptable for a paying pilot
      or if the tier needs confirming before launch.
- [ ] Deploy per `docs/runbooks/deployment-runbook.md` — **note: that
      runbook's step 3 (`pnpm db:migrate deploy`) is stale**, left over
      from the pre-Drizzle version. There is no separate `deploy`
      subcommand now; it's just `pnpm db:migrate`. Fix the runbook before
      following it.
- [ ] Minimal uptime check: a cron hitting `/health` and alerting
      (email/Slack) on failure. Nothing like this exists yet.
- [ ] A Postgres backup cron (`pg_dump` on a schedule, shipped off-box).
      Not built — real org data (FCRA numbers, encrypted site credentials)
      currently has no backup story.

## Phase 4 — Close remaining product gaps (BLOCKING for what you sell)

- [ ] Pick and wire the LLM provider (`LLM_PROVIDER`, `ANTHROPIC_API_KEY`,
      `LLM_MODEL`). Send one real generation request and actually read the
      output before trusting it with a client — only a stubbed request
      shape has been tested so far.
- [ ] Decide: sell Slice 5 content generation without visuals (Skill 5's
      image-generation half was never built), or hold content back until
      it's whole. Recommendation: sell text content now, say plainly that
      visuals aren't included yet — matches the founder's own
      no-half-finished-work standard already in this repo.
- [ ] Decide: pursue Ad Grants for this pilot or defer it. Either way,
      **file the Google Ads API access application now** (Explorer/Basic;
      hours to 5 business days once docs are in) — it's gated outside your
      control, so filing costs nothing even if you don't sell it on day
      one. The monitor is built and tested against fixtures; it has never
      seen real data.
- [ ] Update `docs/integrations/integrations.md` — it's gone stale: Google
      Ads still shows "NOT STARTED" with no note that the connector is
      built and waiting; there's no row for the LLM provider; WordPress
      (genuinely no-gate, built, working) has no row at all. Ten minutes,
      keeps the one dependency tracker honest.

## Phase 5 — Operational readiness (BLOCKING before NGO #1, not before #2-5)

- [ ] A real support channel (email or WhatsApp) — something will break on
      a real NGO's real site; they need a way to reach you.
- [ ] Decide who manually confirms FCRA
      (`pnpm --filter @sector/db confirm-fcra <orgId>`) and **what document
      they actually check** — the script exists, the human process behind
      it doesn't.
- [ ] Read `docs/runbooks/incident-crawler-load.md` and the deployment
      runbook's rollback section once, before you need them under
      pressure, not during an incident.

## Phase 6 — The actual pilot (sequential, not a batch of 5)

- [ ] Onboard **one** forgiving NGO first. Not five at once.
- [ ] Walk their signup live — watch where the UX confuses them.
- [ ] Run their real audit, apply a real WordPress fix if they're on
      WordPress, confirm the score genuinely moved on their real site.
- [ ] Get explicit feedback. Fix what's broken.
- [ ] Only then bring on NGOs 2-5, one at a time, each a checkpoint — not
      a simultaneous batch.

---

## Explicitly NOT needed for 0→5 (don't build these — resist scope creep)

Self-serve billing/Razorpay integration · Skill 5 image generation ·
Wix/Webflow/Squarespace remediation · social publishing (Skill 3, never in
Phase 0-1 scope) · researcher (Skill 6, never in scope) · a CI/CD pipeline
(manual deploy is fine at this scale) · multi-org-per-user.

This list already matches `PROJECT.md`'s own non-goals — repeating it here
so it survives contact with pilot pressure, not because it's new.

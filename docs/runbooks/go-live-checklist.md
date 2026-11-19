# Starter plan: live NGO launch checklist

This is the single launch checklist for the Rs 5,999 + GST Starter pilot. It
separates software that is complete from work that requires a real account,
credential, website, legal decision, or human verification.

## 1. Product scope (code complete)

- [x] First-party email/password authentication, secure server-side sessions,
      password reset tokens, roles, and tenant isolation.
- [x] Resend adapter for password-reset and plan-request email. Missing email
      credentials do not lose a persisted request.
- [x] One shared price source: Starter Rs 5,999/month or Rs 53,999/year,
      plus GST.
- [x] The pricing and signed-in plan forms create a persisted manual-invoice
      request instead of displaying a fake success state.
- [x] Ops lifecycle for each request: `requested -> contacted -> invoiced ->
      paid -> activated`, with a security event when the plan is activated.
- [x] Paid full-site report: own-site verification, deep crawl queue, HTML/PDF
      result, report isolation, and unlimited reports at the plan gate.
- [x] WordPress remediation: Application Password connection, encrypted
      credentials, exact-site checks, review, compare-and-swap apply, re-crawl
      verification, history, and restore.
- [x] Content: brand voice, beneficiary consent records, manual drafts, human
      approval, export, and the 15-piece monthly Starter allowance.
- [x] Calendar: manual entries plus a reviewed one-month suggested plan. A
      three-month plan unlocks after eight exports. It never claims to publish.
- [x] Pilot telemetry: finished reports, content created/approved/exported,
      calendar use, verified fixes, seven-day activity, seven-day outcome North
      Star, and paid Starter activation.

Direct social publishing is not part of Starter. AI generation remains off for
the first pilot; manual drafting is a complete fallback and needs no model key.

## 2. Configure the environment (needs your values)

- [ ] Copy `.env.example` to the production secret store. Never commit `.env`.
- [ ] Set `DATABASE_URL`, `POSTGRES_PASSWORD`, `REDIS_URL`, `APP_URL`,
      `API_URL`, `NEXT_PUBLIC_API_URL`, `SESSION_SECRET`, and `JWT_SECRET`.
- [ ] Generate `CREDENTIAL_ENCRYPTION_KEY` once, store it outside the server,
      and include it in the disaster-recovery record. Losing it makes saved
      WordPress connections unreadable.
- [ ] Verify a sending domain in Resend; set `RESEND_API_KEY`, `EMAIL_FROM`,
      `EMAIL_REPLY_TO`, and `PLAN_REQUEST_NOTIFY_TO`.
- [ ] Leave `ALLOW_PRIVATE_TARGETS` unset in production.
- [ ] Keep `LLM_PROVIDER`, `ANTHROPIC_API_KEY`, and `LLM_MODEL` unset for pilot
      one. Enable them only after the content quality and privacy gate passes.
- [ ] Decide whether Browserless is required for the first NGOs' JavaScript-heavy
      sites; set its URL and token only if it is used.

## 3. Database and deployment

- [ ] Take a database backup before deployment.
- [ ] Apply the complete migration chain through `0008_skinny_wrecker.sql`
      (`0007_regular_redwing.sql` creates plan requests; `0008` enforces its
      plan, billing-cycle, and lifecycle constraints):
      `pnpm db:migrate` locally or
      `docker compose run --rm api npm run migrate` on the server.
- [ ] Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` against
      the exact release commit.
- [ ] Deploy API, web, worker, Postgres, and Redis using the deployment runbook.
- [ ] Confirm `/health` returns 200 and includes a healthy database check.
- [ ] Create external uptime alerts for web and API.
- [ ] Confirm nightly database backups, off-server copy, retention, and one
      restore drill. A backup that has not been restored is not proven.

## 4. Real-world acceptance tests (cannot be proved by local tests)

- [ ] Install `plugins/wordpress/sector-companion` on a staging WordPress site.
- [ ] Create a WordPress Application Password and test connect, preview, apply,
      page-source JSON-LD, re-crawl verification, and restore.
- [ ] Run the public audit on five real NGO sites and manually compare every
      finding with the live page.
- [ ] On one site you control, verify ownership and complete a paid full-site
      report; inspect the HTML and downloaded PDF.
- [ ] In a Starter test organization, create 15 pieces and confirm the 16th is
      blocked; confirm the next calendar month resets the allowance.
- [ ] Test consent: approve and export a beneficiary story, revoke consent, and
      confirm another export is blocked and the calendar shows consent required.
- [ ] Generate the one-month calendar plan, turn two slots into drafts, approve
      and export them, and confirm readiness changes correctly.
- [ ] Request a password reset and a Starter invoice from production; confirm
      the user email, internal notification, links, and reply-to address.
- [ ] Test on a phone, keyboard only, and slow network. Check empty, loading,
      error, success, and retry states—not only the happy path.

## 5. Manual billing operations

List incoming requests:

```sh
pnpm --filter @sector/api plan-request -- --list requested
```

Move one request through the guarded lifecycle:

```sh
pnpm --filter @sector/api plan-request -- <requestId> contacted
pnpm --filter @sector/api plan-request -- <requestId> invoiced
pnpm --filter @sector/api plan-request -- <requestId> paid
pnpm --filter @sector/api plan-request -- <requestId> activate <organizationId>
```

- [ ] Confirm the NGO's legal name, organization type, tax details, price,
      billing cadence, and GST treatment before invoicing.
- [ ] Never activate from a verbal promise. Reconcile the payment first and
      move the request to `paid`.
- [ ] After activation, sign in as the NGO and confirm Starter gates open while
      Pro-only Ad Grants remains locked.
- [ ] Run `pnpm --filter @sector/api funnel -- 7` weekly and record the outcome
      North Star, not only signups.

## 6. Legal and human operations

- [ ] Publish founder/legal-approved Terms, Privacy Policy, and DPDP processing
      language before collecting real organization data.
- [ ] State clearly that FCRA/PAN/12A/80G values are self-declared unless SEctOr
      has separately verified them.
- [ ] Name every production data processor, including Resend and any future LLM.
- [ ] Publish a support email or WhatsApp number with an owner and response time.
- [ ] Assign an incident owner and read the rollback, crawler-load, backup, and
      credential-rotation runbooks before NGO number one.
- [ ] Get explicit permission before changing a live NGO website and use staging
      first. Keep the restore record.

## 7. Pilot sequence and success bar

- [ ] Start with one forgiving NGO, not five at once.
- [ ] Watch them complete signup, audit, report, one WordPress fix, one content
      export, and one calendar entry without coaching where possible.
- [ ] Fix launch-blocking confusion or failures before onboarding NGO two.
- [ ] Speak to five matching buyers. Success bar: at least two accept a paid
      one-month pilot and at least one confirms in writing within 14 days.
- [ ] Expand to NGOs two through five one at a time, treating each as a release
      checkpoint.

## Explicitly deferred

Self-serve Razorpay subscriptions, Clerk migration, direct social publishing,
image generation, Wix/Webflow/Squarespace remediation, automated grants or CSR
tender discovery, and enterprise SSO. These do not block a truthful Starter
pilot and should not delay learning from the first paying NGO.

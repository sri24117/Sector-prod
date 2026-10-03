# Runbook — onboarding a pilot NGO

1. **Server setup (once):** `cp .env.example .env`; set `DATABASE_URL`, `POSTGRES_PASSWORD`, `CREDENTIAL_ENCRYPTION_KEY` (`openssl rand -base64 32` — losing it makes stored connections unreadable; back it up), leave `ALLOW_PRIVATE_TARGETS` unset. `pnpm install && pnpm db:migrate`. Start api, web, worker (+ Redis).
2. **Signup:** NGO creates an account at `/signup` (FCRA/PAN/12A/80G are self-declared, unverified).
3. **Billing:** ADR-0006 is still undecided — for the pilot, invoice manually (no billing code exists).
4. **Audit:** `/audits` -> Run audit.
5. **WordPress fixes:** install `plugins/wordpress/sector-companion` on the client's site (**staging first — never run on real WP yet**), have them create an Application Password, connect at `/audits`.
6. **Ad Grants (only if FCRA is genuinely held):** verify the FCRA certificate yourself, then `pnpm --filter @sector/db confirm-fcra <organizationId>`. Live checks stay off until Google Ads API access is granted.
7. **Content:** set brand voice; record consent BEFORE anyone exports a story naming a beneficiary. LLM env vars must be set.

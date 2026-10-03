# Slice 3 — Remediation (WordPress)

**Built:** persisted audits + findings (org-scoped); `POST /connections/wordpress` (verifies Application-Password credentials AND that the companion plugin is active, stores credentials AES-256-GCM encrypted, never returns them); `POST /findings/:id/remediate` (finding -> generated fix -> apply -> re-crawl -> `RemediationLog` with before/after score); manual fix packages for checks with no live mechanism; SSRF guard on every user-supplied URL; roles (viewer read-only); web UI at `/audits`.

**Fix generation is deterministic** (no LLM): Organization/NGO JSON-LD from the org name + website only — nothing invented.
**JS-crawler caveat honoured:** the companion plugin renders JSON-LD server-side in `wp_head`, so non-JS AI crawlers see it (a client-side snippet would not).
**Guardrail (skill §6):** credentials are re-verified immediately before every live change; a failed apply is logged `failed` and reports "Nothing was changed".

## Verified
10 API tests against real Postgres + a mock WordPress: encrypted-at-rest credentials, wrong-credential and missing-plugin rejection, schema fix applied and **verified live on re-crawl with afterScore > beforeScore recorded**, manual package fallback, already-passing refusal, **cross-tenant** (org B gets 404 on org A's audit/finding/connection/remediations; probing is logged), viewer role 403, unauthenticated 401, SSRF (loopback, link-local metadata IP, RFC1918, localhost).

## NOT verified — read before a client install
1. **The PHP companion plugin (`plugins/wordpress/sector-companion`) has never run on a real WordPress.** The build sandbox had no WordPress; tests use a mock implementing the same REST contract. Install on a staging site first and confirm: Application-Password auth reaches `/sector/v1/*`, the option persists, JSON-LD appears in page source. This is the Slice 3 exit criterion's real-world half.
2. Only `schema` has a live fix. Other checks get a manual package (honestly logged `manual_package_issued`). Wix/Webflow/Squarespace remain deferred per the roadmap.
3. SSRF guard does not defend DNS rebinding between check and fetch.

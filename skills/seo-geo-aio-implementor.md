# Skill 2: SEO/AIO/GEO Implementor

> **Reconstruction note**: this file was rebuilt from a detailed working
> summary after the original session's local workspace was reset. It carries
> the same facts and structure as the version already delivered to the
> founder directly. If a byte-for-byte original copy exists on the founder's
> side, treat that copy as canonical and replace this file with it; otherwise
> this is the working spec.

Status: this is the moat. Skill 1 (Audit Engine) diagnoses; this skill executes the fix live on the client's site. This is the concrete form of the "execution instead of advice" differentiation already agreed with the founder.

## 1. Role and scope

Takes a Skill 1 finding and actually applies the fix on the client's live site, per platform, rather than handing the NGO a to-do list. Writes a `RemediationLog` entry (what changed, on which platform, when, and the verification re-crawl result) so "execution instead of advice" is a provable claim in the product, not just a pitch line.

## 2. Per-CMS mechanism (the central table)

| Platform | Mechanism | Notes |
|---|---|---|
| WordPress | Companion plugin authenticating via WordPress Application Passwords | Buildable now, no external gate. This is the CMS most NGO sites run on, and the one with zero approval dependency, so it is the correct Phase 1 default. |
| Wix | Custom Embeds API (for schema/JS injection) + Robots.txt API | Requires a Wix App Market listing and app review; timeline unconfirmed at time of research. Budget for it, don't assume instant clearance. |
| Webflow | Data API for content/schema; robots.txt control is Enterprise-plan-only | Non-Enterprise Webflow clients get a manual fallback permanently, not as an interim state — disclose this plainly rather than overselling. |
| Squarespace | Effectively closed to programmatic fixes | No practical API surface for this use case found. Manual instructions only. |

## 3. The critical JS-crawler caveat

GPTBot, ClaudeBot, and PerplexityBot do not execute JavaScript. This means a JS-injected fix (e.g. a client-side script adding schema markup) can improve classic search-engine SEO (Googlebot does render JS) but does **not** reach the AI-crawler audience that GEO/AIO is actually about. Any JS-snippet fallback used for platforms without a real content API must be marketed and scoped as classic-SEO-only, never as a GEO fix — this is an easy, dangerous overclaim to build by accident.

## 4. What ships in v1

**Buildable now, no external gate**: WordPress full automation via the companion plugin, plus a manual fix-package fallback (a checklist + copy-paste snippets) for any platform without a live-fix mechanism, so no client is left with literally nothing.

**Ships once its gate clears**: Wix (app review), Webflow robots.txt control (Enterprise-only, so realistically a permanent manual-fallback case for most clients, not a "coming soon").

**Never for Squarespace beyond manual guidance** — disclose this to the client plainly at onboarding once platform is detected, per the founder's own no-half-finished-work standard.

## 5. Data model

Reads `Finding` rows from Skill 1. Writes `RemediationLog` (what changed, platform, timestamp, before/after score from the verification re-crawl). Reads the org's `PlatformConnection` record (set once at onboarding/first crawl, shared with Skill 1's crawl-strategy detection — detect the CMS once, not per skill).

## 6. Guardrails

Never apply a live-site change without having first confirmed, via `PlatformConnection`, that SEctOr's credentials for that org are valid and scoped correctly — a misapplied fix on the wrong org's site is a tenant-isolation failure, not just a bug.

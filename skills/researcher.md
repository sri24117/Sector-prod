# Skill 6: Researcher

> **Reconstruction note**: rebuilt from a detailed working summary after the
> original session's local workspace was reset. If a byte-for-byte original
> copy exists on the founder's side, treat that as canonical.

Status: explicitly required by the founder to align with Skills 4 and 5 rather than surface a bare list — a match must spawn real work, not just an item in an inbox.

## 1. Role and scope

Surfaces funding opportunities, grants, accelerator programs, events, conclaves, summits, seminars, RFQs, tenders, and quotation submissions relevant to a client org — paid and unpaid alike.

## 2. The core finding: no single India NGO-discovery API exists

NGO Darpan, Give.do, GuideStar India, and GeM (Government e-Marketplace) all lack a public API. This mirrors the exact gap already documented in `docs/india-ngo-institutions-landscape` research: there is no canonical, queryable source for "what grants/tenders exist right now," in India or (per the Global.md companion research) anywhere else researched.

## 3. Architecture: a maintained watchlist, not a live query

Because no live-query source exists, this skill is built as a curated, maintained watchlist plus scheduled research jobs (periodic re-checks of named sources, conclave calendars, and grant platforms), not a single API call. This is the same lesson the global research repeats at scale: build from a few genuinely open sources plus a couple of paid-partnership sources worth budgeting for once revenue justifies them, never assume one universal source exists.

## 4. Wired to Skills 4 and 5 (the founder's explicit requirement)

A match (a grant, tender, or event relevant to a specific org) creates a `ResearchMatch` record that spawns a task in Skill 4 (write the application, proposal, or pitch copy) and/or Skill 5 (design the accompanying visual/deck), closing the loop rather than leaving the match as a dead-end notification.

## 5. What ships in v1

**Buildable now, no external gate**: the curated watchlist, the scheduled research jobs, and the `ResearchMatch` → Skill 4/5 task-spawning logic. None of this depends on a partner approval.

**Not buildable, don't promise it**: a GeM-facing seller-registration feature — NGO/trust eligibility as a GeM seller is unconfirmed by any registration guide checked; do not build or promise this until directly confirmed with GeM.

## 6. Data model

`ResearchMatch` (links a discovery to the organization it matched, and to any Skill 4/5 task it spawned).

## 7. Success metric

Match-to-action conversion rate: did a surfaced grant/event actually turn into a Skill 4/5 task and then a real submission — not just "matches surfaced."

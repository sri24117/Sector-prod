# Runbook: Crawler/worker load threatening the box

## Symptom
`docker stats` shows `worker` or `services/crawler` memory climbing toward
its limit, or Postgres/Redis show elevated latency during a batch re-audit.

## Likely cause
A batch re-crawl (weekly, across all onboarded orgs — see Skill 1 §5's open
cost/product decision) running with concurrency too high for the box, or a
spike in JS-dependent sites hitting the Browserless.io fallback at once.

## Immediate mitigation
1. Reduce `WORKER_CONCURRENCY` in `.env` and restart the worker container —
   this is a live-safe change, not a code deploy.
2. Confirm the crawler is respecting per-host rate limits (see
   `skills/audit-engine.md` §4 crawl-etiquette row) — a bug here can look
   like a resource incident but is actually a crawl-politeness bug.
3. If Browserless.io itself is rate-limiting or erroring, check its own
   dashboard before assuming the problem is local.

## Do not
Do not raise a container's `deploy.resources.limits.memory` in
`docker-compose.yml` as the first response — that just moves the OOM risk to
whichever service didn't get the extra headroom. Fix concurrency first;
re-budget the compose file deliberately (see ADR-0003) only with real
numbers behind the change.

## Follow-up
File the actual concurrency numbers that caused the incident into this
runbook so the next person isn't guessing from scratch.

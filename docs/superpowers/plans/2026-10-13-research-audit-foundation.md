# Research Audit Foundation Implementation Plan (Plan 1 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data model, the scoring engine, the plan and ownership gate, and the release gate for the research audit, so that every later plan (rules, reference library, peer research, pillar skills, review UI) plugs into tested foundations.

**Architecture:** A pure scoring function in `packages/shared` blends three layers (rules, reference, peer) into four pillar scores and one overall score. Migration 0004 adds four tables; organization-owned ones are reached only through `scopedDb`. A new API route file gates creation on plan and verified site, and shows an audit's scores and findings to the organization only after an ops script releases it. Nothing here runs a crawl or an LLM.

**Tech Stack:** TypeScript, drizzle-orm 0.36 and drizzle-kit, Postgres, Fastify, zod, vitest (real Postgres in tests), pnpm and turbo.

**Spec:** `docs/superpowers/specs/2026-10-13-research-audit-design.md` (PR #17). This plan covers its "Scoring model", "Access rules", "Data model", and the release half of "Review and release".

## Plan series

This spec is too large for one plan. Each plan below ships working, tested software on its own.

1. **This plan:** scoring core, migration 0004, tenant-scoped repository, gated API, release script.
2. Rules layer and crawl: platform detection, JS fallback, SEO and AIO checks, UI/UX via Lighthouse and axe-core, worker job that produces `in_review` audits. Wires the real `ResearchQueue` into `buildApp`.
3. Reference library: import script and the first ~10 sources (needs real URLs from the owner).
4. Peer research (layer C): search source ADR, fetch, LLM extraction, 30-day cache.
5. Pillar skills and synthesis, with JSON-schema output validation.
6. Review screen, organization tab, PDF, upgrade prompt. **Blocked on a human decision:** the repo has no admin or operator login (`set-plan` is a CLI script). The spec's `/admin/research/[id]` needs an operator auth design; CLAUDE.md section 7 requires a human decision before auth changes.

## Spec amendments made by this plan

Writing this plan exposed two gaps in the spec. Task 2 applies both to the spec file.

1. **Peer sources are not in the library.** The spec said every reference and peer finding cites a `source_id`, but peers are researched live and are not rows in `reference_sources`. Fix: findings carry `source_url` (required for the reference and peer layers) and `source_name`; `source_id` stays as an optional link to a library row, for the reference layer.
2. **Tenant rule.** CLAUDE.md section 3 requires an `organizationId` column on every organization-owned table. `research_findings` and `review_edits` therefore carry `organization_id` too, not only `audit_id`.

## Global Constraints

- Layer shares default to rules 50, reference 30, peer 20. Pillar weights default to 25 each. Both sets must sum to exactly 100. The values used are saved on every audit (`layer_weights`, `pillar_weights`).
- A check that could not run is `could_not_check`: excluded from the score, never counted as a failure.
- A reference or peer finding without a `source_url` is dropped by the scorer and rejected by a database constraint.
- If a layer has no usable data, its weight is redistributed proportionally to the layers that do. If a whole pillar has no data its score is `null`, never 0.
- Plan gate: `organizations.plan` must be `pilot` or `paid`. The organization's own profile website must be verified (`site_verifications.verified_at` set and `host` equal to the site host).
- An audit is hidden from the organization (no scores, no findings, no summary) until `released_at` is set.
- Every query on an organization-owned table filters by `organizationId` and goes through `scopedDb`. Any lookup by caller-supplied id filters by both id and `organizationId`.
- Limits: one active research audit per organization, 3 per organization per day, rate limit 10 per hour on the create route.
- No new service, queue, dependency or abstraction beyond what a task names (CLAUDE.md section 6).
- Code style: match the surrounding files (dense single-line object literals in `tenant-scope.ts`, `.js` import suffixes, zod for request bodies, short comments that say why).

## Review Focus

Failure modes the spec implies but no obvious test would catch. Each has a test in the task that owns the code.

1. A site where every check was `could_not_check` shows overall `null` ("no score"), never 0. (Task 1 test; Task 4 `presentAudit` test.)
2. Weights that do not sum to 100, are negative, or NaN fail loudly instead of producing a plausible wrong score. (Task 1.)
3. The same organization's unreleased audit, fetched by id, shows no scores or findings; another organization's audit id returns 404. (Task 3 and Task 4.)
4. A peer or reference finding with no source is rejected at the database and dropped by the scorer. (Task 1 and Task 2.)
5. Releasing an audit that is `queued`, `running`, `failed`, already `released`, or does not exist is refused with a distinct answer. (Task 5.)

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/shared/src/research-score.ts` (create) | Pure scoring: types, default weights, `scoreResearchAudit`. No I/O. |
| `packages/shared/test/research-score.test.ts` (create) | Unit tests for the scoring function. |
| `packages/shared/package.json` (modify) | Export `./research-score`. |
| `packages/db/src/schema.ts` (modify) | Four new tables. |
| `packages/db/drizzle/0004_*.sql` + `meta/` (generated) | Migration 0004, additive only. |
| `packages/db/src/tenant-scope.ts` (modify) | `researchAudits` repository on `scopedDb`. |
| `packages/db/test/research-audits.test.ts` (create) | Isolation and constraint tests against real Postgres. |
| `apps/api/src/routes/research-audits.ts` (create) | Create, list and get routes, `presentAudit`, `ResearchQueue` type. |
| `apps/api/src/app.ts` (modify) | Register the routes; accept an optional `researchQueue`. |
| `apps/api/test/research-audit.test.ts` (create) | Gate, limits, release visibility and tenancy through the real app. |
| `apps/api/src/lib/research-release.ts` (create) | `releaseAudit(id)`: the only path that sets `released_at`. |
| `apps/api/src/scripts/research-release.ts` (create) | Ops CLI wrapper: `--list` and release by id. |
| `apps/api/test/research-release.test.ts` (create) | Release refusal and success cases. |
| `apps/api/package.json` (modify) | `research-release` script. |
| `docs/superpowers/specs/2026-10-13-research-audit-design.md` (modify) | Apply the two amendments above. |

**Prerequisites for running tests:** Postgres must be reachable at `DATABASE_URL` (default `postgresql://sector:sector@localhost:5432/sector`). On this PC run `bash ~/.local/sector-deps/start-sector.sh` first, or start Docker Desktop and the compose Postgres. Test databases (`sector_test_db`, `sector_test_api`) are created and migrated automatically by each package's global setup.

**Branch:** create `feat/research-audit-foundation` from `main` after PR #17 is merged (or from `docs/research-audit-spec` if not yet merged). Never push to `main`.

---

### Task 1: Scoring core

**Files:**
- Create: `packages/shared/src/research-score.ts`
- Create: `packages/shared/test/research-score.test.ts`
- Modify: `packages/shared/package.json` (exports)

**Interfaces:**
- Consumes: nothing.
- Produces (used by Plan 2 onward and by Task 4):
  - `PILLARS`, `LAYERS` const tuples; `type Pillar`, `type Layer`, `type CheckResult`
  - `interface ScoreFinding { pillar: Pillar; layer: Layer; checkId: string; result: CheckResult; points: number; sourceUrl?: string | null }`
  - `interface Weights { layers: Record<Layer, number>; pillars: Record<Pillar, number> }`
  - `const DEFAULT_WEIGHTS: Weights`
  - `interface LayerScore { score: number | null; earned: number; available: number }`
  - `interface PillarScore { score: number | null; layers: Record<Layer, LayerScore>; missingLayers: Layer[]; couldNotCheck: number; dropped: number }`
  - `interface ResearchScore { pillars: Record<Pillar, PillarScore>; overall: number | null; missingPillars: Pillar[] }`
  - `function scoreResearchAudit(findings: ScoreFinding[], weights?: Weights): ResearchScore`

- [ ] **Step 1: Write the failing tests**

Create `packages/shared/test/research-score.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { scoreResearchAudit, DEFAULT_WEIGHTS, type ScoreFinding, type Pillar, type Layer, type CheckResult } from "../src/research-score.js";

const f = (pillar: Pillar, layer: Layer, result: CheckResult, points: number, sourceUrl?: string): ScoreFinding =>
  ({ pillar, layer, checkId: `${pillar}-${layer}-${result}-${points}`, result, points, sourceUrl: layer === "rules" ? null : (sourceUrl ?? "https://example.org/source") });

describe("scoreResearchAudit", () => {
  it("scores a pillar with only passing rules as 100 and redistributes the empty layers", () => {
    const r = scoreResearchAudit([f("seo", "rules", "pass", 10), f("seo", "rules", "pass", 5)]);
    expect(r.pillars.seo.score).toBe(100);
    expect(r.pillars.seo.layers.rules).toEqual({ score: 100, earned: 15, available: 15 });
    expect(r.pillars.seo.missingLayers).toEqual(["reference", "peer"]);
  });

  it("scores earned over available points", () => {
    const r = scoreResearchAudit([f("seo", "rules", "pass", 10), f("seo", "rules", "fail", 10)]);
    expect(r.pillars.seo.score).toBe(50);
  });

  it("excludes could_not_check from both sides and counts it", () => {
    const r = scoreResearchAudit([f("aio", "rules", "pass", 10), f("aio", "rules", "could_not_check", 40)]);
    expect(r.pillars.aio.score).toBe(100);
    expect(r.pillars.aio.couldNotCheck).toBe(1);
  });

  it("blends the three layers 50/30/20 by default", () => {
    const r = scoreResearchAudit([
      f("uiux", "rules", "pass", 10),
      f("uiux", "reference", "fail", 10),
      f("uiux", "peer", "pass", 10),
    ]);
    expect(r.pillars.uiux.score).toBe(70); // (100*50 + 0*30 + 100*20) / 100
    expect(r.pillars.uiux.missingLayers).toEqual([]);
  });

  it("redistributes a missing layer's weight proportionally", () => {
    const r = scoreResearchAudit([f("brand", "rules", "pass", 10), f("brand", "peer", "fail", 10)]);
    expect(r.pillars.brand.score).toBe(71); // (100*50 + 0*20) / 70 = 71.43
    expect(r.pillars.brand.missingLayers).toEqual(["reference"]);
  });

  it("drops reference and peer findings that have no source", () => {
    const noSource: ScoreFinding = { pillar: "seo", layer: "reference", checkId: "x", result: "pass", points: 10, sourceUrl: null };
    const blank: ScoreFinding = { pillar: "seo", layer: "peer", checkId: "y", result: "pass", points: 10, sourceUrl: "" };
    const r = scoreResearchAudit([noSource, blank, f("seo", "rules", "fail", 10)]);
    expect(r.pillars.seo.dropped).toBe(2);
    expect(r.pillars.seo.layers.reference.score).toBeNull();
    expect(r.pillars.seo.score).toBe(0); // only the failed rules check remains
  });

  it("gives a pillar with no usable data a null score, never 0", () => {
    const r = scoreResearchAudit([f("seo", "rules", "could_not_check", 10)]);
    expect(r.pillars.seo.score).toBeNull();
    expect(r.overall).toBeNull();
    expect(r.missingPillars).toEqual(["seo", "aio", "uiux", "brand"]);
  });

  it("averages only the pillars that have a score", () => {
    const only = scoreResearchAudit([f("seo", "rules", "pass", 10)]);
    expect(only.overall).toBe(100);
    expect(only.missingPillars).toEqual(["aio", "uiux", "brand"]);
    const two = scoreResearchAudit([f("seo", "rules", "pass", 10), f("aio", "rules", "fail", 10)]);
    expect(two.overall).toBe(50);
  });

  it("applies custom pillar weights", () => {
    const weights = { layers: DEFAULT_WEIGHTS.layers, pillars: { seo: 70, aio: 10, uiux: 10, brand: 10 } };
    const r = scoreResearchAudit([f("seo", "rules", "pass", 10), f("aio", "rules", "fail", 10)], weights);
    expect(r.overall).toBe(88); // (100*70 + 0*10) / 80 = 87.5 -> 88
  });

  it("ignores a layer whose weight is 0", () => {
    const weights = { layers: { rules: 100, reference: 0, peer: 0 }, pillars: DEFAULT_WEIGHTS.pillars };
    const r = scoreResearchAudit([f("seo", "rules", "fail", 10), f("seo", "peer", "pass", 10)], weights);
    expect(r.pillars.seo.score).toBe(0);
  });

  it("throws on weights that do not sum to 100, are negative, or are not numbers", () => {
    const bad = (layers: Record<string, number>, pillars: Record<string, number> = DEFAULT_WEIGHTS.pillars) =>
      () => scoreResearchAudit([], { layers, pillars } as never);
    expect(bad({ rules: 50, reference: 30, peer: 10 })).toThrow(/sum to 100/);
    expect(bad({ rules: 120, reference: -20, peer: 0 })).toThrow(/non-negative/);
    expect(bad({ rules: Number.NaN, reference: 50, peer: 50 })).toThrow(/non-negative/);
    expect(bad(DEFAULT_WEIGHTS.layers, { seo: 25, aio: 25, uiux: 25, brand: 20 })).toThrow(/sum to 100/);
  });

  it("throws on negative or non-finite points", () => {
    expect(() => scoreResearchAudit([f("seo", "rules", "pass", -1)])).toThrow(/points/);
    expect(() => scoreResearchAudit([f("seo", "rules", "pass", Number.POSITIVE_INFINITY)])).toThrow(/points/);
  });

  it("returns nulls for no findings at all", () => {
    const r = scoreResearchAudit([]);
    expect(r.overall).toBeNull();
    expect(r.pillars.uiux.score).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @sector/shared test -- research-score`
Expected: FAIL, "Failed to load url ../src/research-score.js" (file does not exist).

- [ ] **Step 3: Write the implementation**

Create `packages/shared/src/research-score.ts`:

```ts
// Research audit scoring (docs/superpowers/specs/2026-10-13-research-audit-design.md).
// Pure and deterministic: no I/O, no LLM. Every honesty rule from the spec is enforced here.

export const PILLARS = ["seo", "aio", "uiux", "brand"] as const;
export const LAYERS = ["rules", "reference", "peer"] as const;
export type Pillar = (typeof PILLARS)[number];
export type Layer = (typeof LAYERS)[number];
export type CheckResult = "pass" | "fail" | "could_not_check";

export interface ScoreFinding {
  pillar: Pillar;
  layer: Layer;
  checkId: string;
  result: CheckResult;
  /** What this check is worth. A pass earns it; a fail earns 0; could_not_check is ignored. */
  points: number;
  /** Required for the reference and peer layers. Findings without one are dropped. */
  sourceUrl?: string | null;
}

export interface Weights { layers: Record<Layer, number>; pillars: Record<Pillar, number> }

export const DEFAULT_WEIGHTS: Weights = {
  layers: { rules: 50, reference: 30, peer: 20 },
  pillars: { seo: 25, aio: 25, uiux: 25, brand: 25 },
};

export interface LayerScore { score: number | null; earned: number; available: number }
export interface PillarScore {
  score: number | null;
  layers: Record<Layer, LayerScore>;
  /** Layers with no usable data; their weight was redistributed. */
  missingLayers: Layer[];
  couldNotCheck: number;
  /** Reference or peer findings dropped for having no source. */
  dropped: number;
}
export interface ResearchScore {
  pillars: Record<Pillar, PillarScore>;
  /** null when no pillar has a score. */
  overall: number | null;
  missingPillars: Pillar[];
}

function assertWeights(weights: Record<string, number>, label: string): void {
  const values = Object.values(weights);
  if (values.some((v) => !Number.isFinite(v) || v < 0)) throw new Error(`${label} weights must be non-negative numbers`);
  const sum = values.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 1e-9) throw new Error(`${label} weights must sum to 100 (got ${sum})`);
}

export function scoreResearchAudit(findings: ScoreFinding[], weights: Weights = DEFAULT_WEIGHTS): ResearchScore {
  assertWeights(weights.layers, "layer");
  assertWeights(weights.pillars, "pillar");
  for (const x of findings) {
    if (!Number.isFinite(x.points) || x.points < 0) throw new Error(`Invalid points for ${x.checkId}`);
  }

  const pillars = {} as Record<Pillar, PillarScore>;
  for (const pillar of PILLARS) {
    const layers = Object.fromEntries(LAYERS.map((l) => [l, { score: null, earned: 0, available: 0 }])) as Record<Layer, LayerScore>;
    let couldNotCheck = 0;
    let dropped = 0;
    for (const x of findings) {
      if (x.pillar !== pillar) continue;
      if (x.layer !== "rules" && !x.sourceUrl) { dropped++; continue; }
      if (x.result === "could_not_check") { couldNotCheck++; continue; }
      layers[x.layer].available += x.points;
      if (x.result === "pass") layers[x.layer].earned += x.points;
    }

    let weighted = 0;
    let weightSum = 0;
    for (const l of LAYERS) {
      const layer = layers[l];
      if (layer.available <= 0) continue;
      const raw = (layer.earned / layer.available) * 100;
      layer.score = Math.round(raw);
      if (weights.layers[l] > 0) { weighted += raw * weights.layers[l]; weightSum += weights.layers[l]; }
    }
    pillars[pillar] = {
      score: weightSum > 0 ? Math.round(weighted / weightSum) : null,
      layers,
      missingLayers: LAYERS.filter((l) => layers[l].score === null),
      couldNotCheck,
      dropped,
    };
  }

  let weighted = 0;
  let weightSum = 0;
  for (const p of PILLARS) {
    const s = pillars[p].score;
    if (s === null || weights.pillars[p] <= 0) continue;
    weighted += s * weights.pillars[p];
    weightSum += weights.pillars[p];
  }
  return {
    pillars,
    overall: weightSum > 0 ? Math.round(weighted / weightSum) : null,
    missingPillars: PILLARS.filter((p) => pillars[p].score === null),
  };
}
```

Add the export in `packages/shared/package.json` so `exports` reads:

```json
  "exports": {
    ".": "./src/index.ts",
    "./net-guard": "./src/net-guard.ts",
    "./research-score": "./src/research-score.ts"
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @sector/shared test -- research-score && pnpm --filter @sector/shared typecheck`
Expected: all 13 tests PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): research audit scoring core"
```

---

### Task 2: Schema and migration 0004 (and spec amendments)

**Files:**
- Modify: `packages/db/src/schema.ts` (imports on lines 1-2; append after the `reports` table)
- Generate: `packages/db/drizzle/0004_*.sql`, `packages/db/drizzle/meta/*`
- Modify: `docs/superpowers/specs/2026-10-13-research-audit-design.md`

**Interfaces:**
- Consumes: the `id()`, `orgRef()`, `created()` helpers and `organizations` already in `schema.ts`.
- Produces: `schema.referenceSources`, `schema.researchAudits`, `schema.researchFindings`, `schema.reviewEdits` (exported through the existing `schema` namespace in `client.ts`). Column property names used by Tasks 3-5:
  - `researchAudits`: `id, organizationId, siteUrl, platform, status, error, seoScore, aioScore, uiuxScore, brandScore, overallScore, layerWeights, pillarWeights, summary, createdBy, createdAt, releasedAt`
  - `researchFindings`: `id, auditId, organizationId, pillar, layer, checkId, result, evidence, sourceId, sourceUrl, sourceName, fix, effort, points`

- [ ] **Step 1: Edit the imports in `packages/db/src/schema.ts`**

Replace the first two lines with:

```ts
import { pgTable, pgEnum, text, boolean, timestamp, uniqueIndex, index, integer, jsonb, customType, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
```

- [ ] **Step 2: Append the tables to the end of `packages/db/src/schema.ts`**

```ts

// ---------------- Research audit (docs/superpowers/specs/2026-10-13-research-audit-design.md) ----------------
// The owner's curated library of proven organizations. Global (not organization-owned): written only by the
// owner's import script, read-only for the product.
export const referenceSources = pgTable("reference_sources", {
  id: id(), name: text("name").notNull(),
  orgType: text("org_type").notNull(), // ngo | foundation | csr
  cause: text("cause"), region: text("region"), url: text("url").notNull(),
  retrievedOn: timestamp("retrieved_on", { withTimezone: true }).notNull(),
  strengths: jsonb("strengths").notNull(), // { seo?: string[], aio?: string[], uiux?: string[], brand?: string[] }
  createdAt: created(),
});

export const researchAudits = pgTable("research_audits", {
  id: id(), organizationId: orgRef(), siteUrl: text("site_url").notNull(), platform: text("platform"),
  status: text("status").notNull().default("queued"), // queued | running | in_review | released | failed
  error: text("error"),
  seoScore: integer("seo_score"), aioScore: integer("aio_score"), uiuxScore: integer("uiux_score"), brandScore: integer("brand_score"), overallScore: integer("overall_score"),
  layerWeights: jsonb("layer_weights"), pillarWeights: jsonb("pillar_weights"), summary: jsonb("summary"),
  createdBy: text("created_by").notNull(), createdAt: created(),
  releasedAt: timestamp("released_at", { withTimezone: true }),
}, (t) => [
  index("research_audits_org_created_idx").on(t.organizationId, t.createdAt),
  check("research_audits_status_ck", sql`${t.status} in ('queued','running','in_review','released','failed')`),
]);

export const researchFindings = pgTable("research_findings", {
  id: id(), auditId: text("audit_id").notNull().references(() => researchAudits.id, { onDelete: "cascade" }), organizationId: orgRef(),
  pillar: text("pillar").notNull(), layer: text("layer").notNull(), checkId: text("check_id").notNull(),
  result: text("result").notNull(), evidence: text("evidence"),
  sourceId: text("source_id").references(() => referenceSources.id, { onDelete: "set null" }),
  sourceUrl: text("source_url"), sourceName: text("source_name"),
  fix: text("fix"), effort: text("effort"), points: integer("points").notNull().default(0),
}, (t) => [
  index("research_findings_audit_idx").on(t.auditId),
  check("research_findings_pillar_ck", sql`${t.pillar} in ('seo','aio','uiux','brand')`),
  check("research_findings_layer_ck", sql`${t.layer} in ('rules','reference','peer')`),
  check("research_findings_result_ck", sql`${t.result} in ('pass','fail','could_not_check')`),
  // Honesty rule: a benchmark comparison must cite a source.
  check("research_findings_source_ck", sql`${t.layer} = 'rules' or ${t.sourceUrl} is not null`),
]);

// The owner's overrides. The original AI output is never overwritten; every change is recorded here.
export const reviewEdits = pgTable("review_edits", {
  id: id(), auditId: text("audit_id").notNull().references(() => researchAudits.id, { onDelete: "cascade" }), organizationId: orgRef(),
  target: text("target").notNull(), oldValue: jsonb("old_value"), newValue: jsonb("new_value"),
  note: text("note").notNull(), createdAt: created(),
}, (t) => [index("review_edits_audit_idx").on(t.auditId)]);
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm --filter @sector/db generate`
Expected: creates `packages/db/drizzle/0004_<adjective>_<name>.sql` and updates `meta/_journal.json` plus a new `0004_snapshot.json`. No database connection is needed.

- [ ] **Step 4: Read the generated SQL**

Open the new `0004_*.sql`. Confirm it contains only `CREATE TABLE`, `ALTER TABLE ... ADD CONSTRAINT` (foreign keys) and `CREATE INDEX` statements for the four new tables, with the five `CHECK` constraints present, and no `DROP`, `ALTER COLUMN` or changes to existing tables. If anything else appears, stop and report it; the migration must be additive because production deploys run it against live data.

- [ ] **Step 5: Apply the spec amendments**

In `docs/superpowers/specs/2026-10-13-research-audit-design.md`:

Replace the `research_findings` data-model bullet with:
`- `research_findings`: `id`, `audit_id`, `organization_id`, `pillar`, `layer` (`rules | reference | peer`), `check_id`, `result` (`pass | fail | could_not_check`), `evidence`, `source_id` (optional link to a library row, reference layer), `source_url` and `source_name` (required for reference and peer), `fix`, `effort`, `points`. A database constraint rejects reference and peer rows with no `source_url`.`

Replace the `review_edits` bullet's start with `- `review_edits`: `id`, `audit_id`, `organization_id`, ...` (keep the rest).

Replace honesty rule 2 with:
`2. A `reference` or `peer` finding **must** cite a `source_url`. A finding without one is dropped by the scorer and rejected by the database.`

- [ ] **Step 6: Verify the migration applies and nothing else broke**

Run: `pnpm --filter @sector/db test`
Expected: PASS. The test database is migrated through 0004 by the global setup, so an invalid migration fails here.

- [ ] **Step 7: Commit**

```bash
git add packages/db docs/superpowers/specs
git commit -m "feat(db): research audit tables (migration 0004)"
```

---

### Task 3: Tenant-scoped repository

**Files:**
- Modify: `packages/db/src/tenant-scope.ts` (add a `researchAudits` block inside the object returned by `scopedDb`, after the `reports` block, before the closing `};` at line ~199)
- Create: `packages/db/test/research-audits.test.ts`

**Interfaces:**
- Consumes: `schema.researchAudits`, `schema.researchFindings`, `schema.referenceSources` (Task 2).
- Produces on `scopedDb(orgId).researchAudits`:
  - `create(data: { siteUrl: string; platform?: string | null; createdBy: string }): Promise<AuditRow>`
  - `findById(auditId: string): Promise<AuditRow | null>` (any status; for the worker and ops)
  - `list(): Promise<AuditRow[]>` (newest first, max 50)
  - `activeCount(): Promise<number>` (queued or running, created in the last 60 minutes)
  - `countSince(since: Date): Promise<number>`
  - `update(auditId: string, set: Partial<Pick<typeof schema.researchAudits.$inferInsert, "status" | "error" | "platform" | "seoScore" | "aioScore" | "uiuxScore" | "brandScore" | "overallScore" | "layerWeights" | "pillarWeights" | "summary">>): Promise<{ id: string } | null>`. It deliberately cannot set `releasedAt`; only the ops release path does.
  - `addFindings(auditId: string, rows: NewFinding[]): Promise<number>` where `NewFinding = Omit<typeof schema.researchFindings.$inferInsert, "id" | "auditId" | "organizationId">`; throws `Error("audit_not_found")` if the audit is not this organization's
  - `findings(auditId: string): Promise<FindingRow[]>` (all statuses; internal use)
  - `releasedFindings(auditId: string): Promise<FindingRow[] | null>` (`null` unless that audit is `released`)
  - `AuditRow` is `typeof schema.researchAudits.$inferSelect`.

- [ ] **Step 1: Write the failing tests**

Create `packages/db/test/research-audits.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { rawDb, pool, schema } from "../src/client.js";
import { scopedDb } from "../src/tenant-scope.js";

const orgA = crypto.randomUUID();
const orgB = crypto.randomUUID();
let auditA: string;

beforeAll(async () => {
  await rawDb.insert(schema.organizations).values([{ id: orgA, name: "Org A" }, { id: orgB, name: "Org B" }]);
  auditA = (await scopedDb(orgA).researchAudits.create({ siteUrl: "https://a.example.org/", createdBy: "u1" })).id;
});
afterAll(async () => {
  await pool.query("TRUNCATE organizations, reference_sources CASCADE");
  await pool.end();
});

describe("researchAudits repository", () => {
  it("creates a queued audit scoped to the organization", async () => {
    const row = await scopedDb(orgA).researchAudits.findById(auditA);
    expect(row?.status).toBe("queued");
    expect(row?.organizationId).toBe(orgA);
    expect(row?.releasedAt).toBeNull();
  });

  it("never returns another organization's audit by id", async () => {
    expect(await scopedDb(orgB).researchAudits.findById(auditA)).toBeNull();
    expect(await scopedDb(orgB).researchAudits.list()).toEqual([]);
    expect(await scopedDb(orgB).researchAudits.update(auditA, { status: "failed" })).toBeNull();
    expect((await scopedDb(orgA).researchAudits.findById(auditA))?.status).toBe("queued");
  });

  it("refuses to add findings to another organization's audit", async () => {
    await expect(scopedDb(orgB).researchAudits.addFindings(auditA, [{ pillar: "seo", layer: "rules", checkId: "c", result: "pass", points: 5 }])).rejects.toThrow("audit_not_found");
  });

  it("stores findings and returns them only through releasedFindings once released", async () => {
    const db = scopedDb(orgA).researchAudits;
    expect(await db.addFindings(auditA, [
      { pillar: "seo", layer: "rules", checkId: "title", result: "fail", points: 10, fix: "Add a title" },
      { pillar: "seo", layer: "peer", checkId: "peer-faq", result: "pass", points: 5, sourceUrl: "https://peer.example.org/", sourceName: "Peer NGO" },
    ])).toBe(2);
    expect((await db.findings(auditA)).length).toBe(2);
    expect(await db.releasedFindings(auditA)).toBeNull(); // queued
    await db.update(auditA, { status: "in_review" });
    expect(await db.releasedFindings(auditA)).toBeNull(); // in review is still hidden
    await rawDb.update(schema.researchAudits).set({ status: "released", releasedAt: new Date() }).where(eq(schema.researchAudits.id, auditA));
    const shown = await db.releasedFindings(auditA);
    expect(shown?.length).toBe(2);
    expect(shown?.find((x) => x.layer === "peer")?.sourceName).toBe("Peer NGO");
    expect(await scopedDb(orgB).researchAudits.releasedFindings(auditA)).toBeNull();
  });

  it("update cannot set releasedAt", async () => {
    const db = scopedDb(orgA).researchAudits;
    const b = await db.create({ siteUrl: "https://a.example.org/", createdBy: "u1" });
    await db.update(b.id, { status: "in_review", releasedAt: new Date() } as never);
    expect((await db.findById(b.id))?.releasedAt).toBeNull();
  });

  it("counts active audits and audits since a time", async () => {
    const db = scopedDb(orgB).researchAudits;
    expect(await db.activeCount()).toBe(0);
    const x = await db.create({ siteUrl: "https://b.example.org/", createdBy: "u2" });
    expect(await db.activeCount()).toBe(1);
    await db.update(x.id, { status: "in_review" });
    expect(await db.activeCount()).toBe(0);
    expect(await db.countSince(new Date(Date.now() - 60_000))).toBe(1);
    expect(await db.countSince(new Date(Date.now() + 60_000))).toBe(0);
  });
});

describe("research tables constraints", () => {
  it("rejects a peer or reference finding with no source_url", async () => {
    for (const layer of ["peer", "reference"]) {
      await expect(rawDb.insert(schema.researchFindings).values({ auditId: auditA, organizationId: orgA, pillar: "seo", layer, checkId: "x", result: "pass", points: 5 })).rejects.toThrow();
    }
  });

  it("rejects unknown pillar, layer, result and status values", async () => {
    const base = { auditId: auditA, organizationId: orgA, pillar: "seo", layer: "rules", checkId: "x", result: "pass", points: 1 };
    await expect(rawDb.insert(schema.researchFindings).values({ ...base, pillar: "social" })).rejects.toThrow();
    await expect(rawDb.insert(schema.researchFindings).values({ ...base, layer: "guess" })).rejects.toThrow();
    await expect(rawDb.insert(schema.researchFindings).values({ ...base, result: "maybe" })).rejects.toThrow();
    await expect(rawDb.update(schema.researchAudits).set({ status: "done" }).where(eq(schema.researchAudits.id, auditA))).rejects.toThrow();
  });

  it("deleting an organization removes its audits and findings", async () => {
    const o = crypto.randomUUID();
    await rawDb.insert(schema.organizations).values({ id: o, name: "Temp" });
    const a = await scopedDb(o).researchAudits.create({ siteUrl: "https://t.example.org/", createdBy: "u" });
    await scopedDb(o).researchAudits.addFindings(a.id, [{ pillar: "seo", layer: "rules", checkId: "c", result: "pass", points: 1 }]);
    await rawDb.delete(schema.organizations).where(eq(schema.organizations.id, o));
    expect(await rawDb.select().from(schema.researchFindings).where(eq(schema.researchFindings.auditId, a.id))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @sector/db test -- research-audits`
Expected: FAIL, `scopedDb(...).researchAudits` is undefined (TypeError).

- [ ] **Step 3: Implement the repository**

In `packages/db/src/tenant-scope.ts`, add this block inside the returned object, directly after the `reports: { ... },` block:

```ts
    // Research audit (specs/2026-10-13-research-audit-design.md). `update` cannot set releasedAt: only
    // apps/api/src/lib/research-release.ts does, so an audit cannot become visible by accident.
    researchAudits: {
      create: (data: { siteUrl: string; platform?: string | null; createdBy: string }) =>
        rawDb.insert(schema.researchAudits).values({ ...data, organizationId }).returning().then((r) => r[0]!),
      findById: (auditId: string) =>
        rawDb.select().from(schema.researchAudits).where(and(eq(schema.researchAudits.id, auditId), eq(schema.researchAudits.organizationId, organizationId))).then((r) => r[0] ?? null),
      list: () =>
        rawDb.select().from(schema.researchAudits).where(eq(schema.researchAudits.organizationId, organizationId)).orderBy(desc(schema.researchAudits.createdAt)).limit(50),
      activeCount: () => rawDb.select({ id: schema.researchAudits.id }).from(schema.researchAudits)
        .where(and(eq(schema.researchAudits.organizationId, organizationId), inArray(schema.researchAudits.status, ["queued", "running"]), gt(schema.researchAudits.createdAt, new Date(Date.now() - 60 * 60_000)))).then((r) => r.length),
      countSince: (since: Date) => rawDb.select({ id: schema.researchAudits.id }).from(schema.researchAudits)
        .where(and(eq(schema.researchAudits.organizationId, organizationId), gt(schema.researchAudits.createdAt, since))).then((r) => r.length),
      update: (auditId: string, set: Partial<Pick<typeof schema.researchAudits.$inferInsert, "status" | "error" | "platform" | "seoScore" | "aioScore" | "uiuxScore" | "brandScore" | "overallScore" | "layerWeights" | "pillarWeights" | "summary">>) => {
        const { status, error, platform, seoScore, aioScore, uiuxScore, brandScore, overallScore, layerWeights, pillarWeights, summary } = set;
        const allowed = Object.fromEntries(Object.entries({ status, error, platform, seoScore, aioScore, uiuxScore, brandScore, overallScore, layerWeights, pillarWeights, summary }).filter(([, v]) => v !== undefined));
        return rawDb.update(schema.researchAudits).set(allowed).where(and(eq(schema.researchAudits.id, auditId), eq(schema.researchAudits.organizationId, organizationId))).returning({ id: schema.researchAudits.id }).then((r) => r[0] ?? null);
      },
      addFindings: async (auditId: string, rows: Omit<typeof schema.researchFindings.$inferInsert, "id" | "auditId" | "organizationId">[]) => {
        const own = await rawDb.select({ id: schema.researchAudits.id }).from(schema.researchAudits)
          .where(and(eq(schema.researchAudits.id, auditId), eq(schema.researchAudits.organizationId, organizationId)));
        if (!own[0]) throw new Error("audit_not_found");
        if (rows.length === 0) return 0;
        await rawDb.insert(schema.researchFindings).values(rows.map((r) => ({ ...r, auditId, organizationId })));
        return rows.length;
      },
      findings: (auditId: string) => rawDb.select().from(schema.researchFindings)
        .where(and(eq(schema.researchFindings.auditId, auditId), eq(schema.researchFindings.organizationId, organizationId))),
      // Only a released audit's findings ever reach the organization.
      releasedFindings: async (auditId: string) => {
        const released = await rawDb.select({ id: schema.researchAudits.id }).from(schema.researchAudits)
          .where(and(eq(schema.researchAudits.id, auditId), eq(schema.researchAudits.organizationId, organizationId), eq(schema.researchAudits.status, "released")));
        if (!released[0]) return null;
        return rawDb.select().from(schema.researchFindings)
          .where(and(eq(schema.researchFindings.auditId, auditId), eq(schema.researchFindings.organizationId, organizationId)));
      },
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @sector/db test && pnpm --filter @sector/db typecheck`
Expected: all PASS (including the existing tenant-isolation test), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat(db): tenant-scoped research audit repository"
```

---

### Task 4: Gated API routes

**Files:**
- Create: `apps/api/src/routes/research-audits.ts`
- Modify: `apps/api/src/app.ts` (import near line 16; `buildApp` opts at line 20; registration near line 46)
- Create: `apps/api/test/research-audit.test.ts`

**Interfaces:**
- Consumes: `scopedDb(...).researchAudits` and `.siteVerification`, `.organization`, `.organizationProfile` (Task 3 and existing); `authenticate`, `requireRole` from `../auth/middleware.js`; `siteHost` from `../lib/site-verification.js`.
- Produces:
  - `interface ResearchQueue { add(job: { auditId: string; organizationId: string }): Promise<void> }` (exported; Plan 2 implements it with BullMQ)
  - `presentAudit(row: AuditRow): PresentedAudit`, exported for tests
  - `registerResearchAuditRoutes(app: FastifyInstance, queue?: ResearchQueue): Promise<void>`. `POST /research-audits` is registered only when a queue is given.
  - `buildApp` option `researchQueue?: ResearchQueue`.
  - HTTP: `POST /research-audits` 202 `{ id, status }`; errors 403 `plan_required`, 403 `site_not_verified`, 409 `research_in_progress`, 429 `daily_limit`, 503 `queue_unavailable`. `GET /research-audits` `{ audits: PresentedAudit[] }`. `GET /research-audits/:id` `{ audit: PresentedAudit, findings: Finding[] | null }` or 404 `not_found`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/research-audit.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { pool, rawDb, schema, scopedDb } from "@sector/db";
import { buildApp } from "../src/app.js";
import { siteHost } from "../src/lib/site-verification.js";
import { presentAudit } from "../src/routes/research-audits.js";

// Research audit foundation (docs/superpowers/plans/2026-10-13-research-audit-foundation.md):
// plan and ownership gate, limits, release visibility, tenancy.
let app: FastifyInstance;
const queued: { auditId: string; organizationId: string }[] = [];
let failQueue = false;

async function signup(name: string, email: string, websiteUrl: string) {
  const res = await app.inject({ method: "POST", url: "/auth/signup", payload: { organizationName: name, name: "Owner", email, password: "long-enough-password", websiteUrl, orgType: "ngo" } });
  expect(res.statusCode).toBe(201);
  const c = res.cookies.find((x) => x.name === "sector_session")!;
  return { cookie: `${c.name}=${c.value}`, orgId: res.json().organizationId as string, url: websiteUrl };
}
const call = (cookie: string, method: "GET" | "POST", url: string) => app.inject({ method, url, headers: { cookie } });
async function makeEligible(o: { orgId: string; url: string }) {
  await rawDb.update(schema.organizations).set({ plan: "pilot" }).where(eq(schema.organizations.id, o.orgId));
  const db = scopedDb(o.orgId);
  await db.siteVerification.ensure(siteHost(o.url));
  await db.siteVerification.markVerified("meta");
}
async function release(auditId: string) {
  await rawDb.update(schema.researchAudits).set({ status: "released", releasedAt: new Date(), seoScore: 80, aioScore: 60, uiuxScore: 70, brandScore: 50, overallScore: 65, summary: { headline: "ok" } }).where(eq(schema.researchAudits.id, auditId));
}

beforeAll(async () => {
  app = await buildApp({
    reportQueue: { add: async () => {} },
    researchQueue: { add: async (job) => { if (failQueue) throw new Error("redis down"); queued.push(job); } },
  });
  await app.ready();
});
afterAll(async () => {
  await pool.query("TRUNCATE organizations, users, memberships, organization_profiles, sessions, security_event_log, site_verifications, funnel_events, reference_sources CASCADE");
  await app.close(); await pool.end();
});

describe("research audit API", () => {
  let A: Awaited<ReturnType<typeof signup>>; let B: Awaited<ReturnType<typeof signup>>;
  let auditId: string;

  it("refuses a free-plan organization", async () => {
    A = await signup("Asha NGO", "a@asha.org", "https://asha.example.org/");
    B = await signup("Other NGO", "b@other.org", "https://other.example.org/");
    const res = await call(A.cookie, "POST", "/research-audits");
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("plan_required");
  });

  it("refuses a paid organization whose website is not verified", async () => {
    await rawDb.update(schema.organizations).set({ plan: "pilot" }).where(eq(schema.organizations.id, A.orgId));
    const res = await call(A.cookie, "POST", "/research-audits");
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("site_not_verified");
  });

  it("queues an audit for an eligible organization and allows only one at a time", async () => {
    await makeEligible(A);
    const res = await call(A.cookie, "POST", "/research-audits");
    expect(res.statusCode).toBe(202);
    auditId = res.json().id;
    expect(queued).toEqual([{ auditId, organizationId: A.orgId }]);
    const again = await call(A.cookie, "POST", "/research-audits");
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe("research_in_progress");
  });

  it("hides scores and findings until the audit is released", async () => {
    await scopedDb(A.orgId).researchAudits.addFindings(auditId, [{ pillar: "seo", layer: "rules", checkId: "title", result: "fail", points: 10, fix: "Add a title" }]);
    await scopedDb(A.orgId).researchAudits.update(auditId, { status: "in_review", seoScore: 80, overallScore: 65, summary: { headline: "secret draft" } });
    const one = (await call(A.cookie, "GET", `/research-audits/${auditId}`)).json();
    expect(one.audit.status).toBe("in_review");
    expect(one.audit.overallScore).toBeNull();
    expect(one.audit.seoScore).toBeNull();
    expect(one.audit.summary).toBeNull();
    expect(one.findings).toBeNull();
    const list = (await call(A.cookie, "GET", "/research-audits")).json();
    expect(list.audits[0].overallScore).toBeNull();
    expect(JSON.stringify(list)).not.toContain("secret draft");
  });

  it("shows scores, summary and cited findings after release", async () => {
    await release(auditId);
    const one = (await call(A.cookie, "GET", `/research-audits/${auditId}`)).json();
    expect(one.audit.status).toBe("released");
    expect(one.audit.overallScore).toBe(65);
    expect(one.audit.summary).toEqual({ headline: "ok" });
    expect(one.findings).toHaveLength(1);
    expect(one.findings[0].fix).toBe("Add a title");
  });

  it("returns 404 for another organization's audit and for unknown ids", async () => {
    expect((await call(B.cookie, "GET", `/research-audits/${auditId}`)).statusCode).toBe(404);
    expect((await call(B.cookie, "GET", `/research-audits/${crypto.randomUUID()}`)).statusCode).toBe(404);
    expect((await call(B.cookie, "GET", "/research-audits")).json().audits).toEqual([]);
  });

  it("requires a signed-in user", async () => {
    expect((await app.inject({ method: "GET", url: "/research-audits" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/research-audits" })).statusCode).toBe(401);
  });

  it("stops at 3 audits a day", async () => {
    // A already has 1 released audit today; add 2 more finished ones, then the 4th attempt is refused.
    for (let i = 0; i < 2; i++) await scopedDb(A.orgId).researchAudits.create({ siteUrl: A.url, createdBy: "u" }).then((r) => release(r.id));
    const res = await call(A.cookie, "POST", "/research-audits");
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe("daily_limit");
  });

  it("marks the audit failed and answers 503 when the queue is down", async () => {
    await makeEligible(B);
    failQueue = true;
    const res = await call(B.cookie, "POST", "/research-audits");
    failQueue = false;
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe("queue_unavailable");
    const [row] = await scopedDb(B.orgId).researchAudits.list();
    expect(row!.status).toBe("failed");
  });
});

describe("presentAudit", () => {
  const base = { id: "a", organizationId: "o", siteUrl: "https://x.org/", platform: "wix", status: "released", error: "boom", seoScore: 1, aioScore: 2, uiuxScore: 3, brandScore: 4, overallScore: null, layerWeights: { rules: 50 }, pillarWeights: { seo: 25 }, summary: { s: 1 }, createdBy: "u", createdAt: new Date("2026-10-13"), releasedAt: new Date("2026-10-14") };
  it("keeps a released audit with no overall score as null, not 0", () => {
    expect(presentAudit(base as never).overallScore).toBeNull();
  });
  it("never exposes internal fields", () => {
    const shown = presentAudit(base as never) as Record<string, unknown>;
    expect(shown).not.toHaveProperty("error");
    expect(shown).not.toHaveProperty("createdBy");
    expect(shown).not.toHaveProperty("organizationId");
  });
  it("hides everything but status for an unreleased audit, even a failed one", () => {
    const shown = presentAudit({ ...base, status: "failed", releasedAt: null } as never);
    expect(shown.status).toBe("failed");
    expect(shown.seoScore).toBeNull();
    expect(shown.summary).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @sector/api test -- research-audit`
Expected: FAIL, "Failed to load url ../src/routes/research-audits.js".

- [ ] **Step 3: Write the routes**

Create `apps/api/src/routes/research-audits.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { scopedDb, type ScopedDb } from "@sector/db";
import { authenticate, requireRole } from "../auth/middleware.js";
import { siteHost } from "../lib/site-verification.js";

// Research audit (docs/superpowers/specs/2026-10-13-research-audit-design.md): plan and ownership gate,
// and release-gated visibility. Every query goes through scopedDb(request.auth.organizationId).

export interface ResearchQueue { add(job: { auditId: string; organizationId: string }): Promise<void> }

type AuditRow = Awaited<ReturnType<ScopedDb["researchAudits"]["findById"]>> & object;

const PAID_PLANS = new Set(["pilot", "paid"]);
const DAILY_LIMIT = 3;

// What the organization may see. Scores, summary and weights appear only once the owner has released
// the audit; the internal error text, creator and organization id never appear.
export function presentAudit(row: AuditRow) {
  const released = row.status === "released" && row.releasedAt !== null;
  return {
    id: row.id, siteUrl: row.siteUrl, platform: row.platform, status: row.status, createdAt: row.createdAt,
    releasedAt: released ? row.releasedAt : null,
    seoScore: released ? row.seoScore : null, aioScore: released ? row.aioScore : null,
    uiuxScore: released ? row.uiuxScore : null, brandScore: released ? row.brandScore : null,
    overallScore: released ? row.overallScore : null,
    layerWeights: released ? row.layerWeights : null, pillarWeights: released ? row.pillarWeights : null,
    summary: released ? row.summary : null,
  };
}

export async function registerResearchAuditRoutes(app: FastifyInstance, queue?: ResearchQueue): Promise<void> {
  const write = [authenticate, requireRole(["owner", "staff"])];

  async function ownVerifiedSite(db: ScopedDb): Promise<string | null> {
    const profile = await db.organizationProfile.get();
    if (!profile?.websiteUrl) return null;
    let host: string;
    try { host = siteHost(profile.websiteUrl); } catch { return null; }
    const verification = await db.siteVerification.get();
    return verification?.verifiedAt && verification.host === host ? profile.websiteUrl : null;
  }

  // Registered only when a queue exists, so production cannot create audits nothing will process.
  if (queue) {
    app.post("/research-audits", { preHandler: write, config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req, reply) => {
      const auth = req.auth!; const db = scopedDb(auth.organizationId);
      const org = await db.organization.get();
      if (!org || !PAID_PLANS.has(org.plan)) return reply.status(403).send({ error: "plan_required", message: "The research audit is part of the paid plan. Contact SEctOr to upgrade." });
      const siteUrl = await ownVerifiedSite(db);
      if (!siteUrl) return reply.status(403).send({ error: "site_not_verified", message: "Verify that you own your website first." });
      if ((await db.researchAudits.activeCount()) > 0) return reply.status(409).send({ error: "research_in_progress", message: "A research audit is already being prepared. It can take a while." });
      if ((await db.researchAudits.countSince(new Date(Date.now() - 86_400_000))) >= DAILY_LIMIT) {
        return reply.status(429).send({ error: "daily_limit", message: `You can request up to ${DAILY_LIMIT} research audits a day.` });
      }
      const audit = await db.researchAudits.create({ siteUrl, createdBy: auth.userId });
      try {
        await queue.add({ auditId: audit.id, organizationId: auth.organizationId });
      } catch (err) {
        req.log.error({ err }, "could not queue research audit");
        await db.researchAudits.update(audit.id, { status: "failed", error: "Could not queue the audit." });
        return reply.status(503).send({ error: "queue_unavailable", message: "We could not start the audit. Please try again shortly." });
      }
      return reply.status(202).send({ id: audit.id, status: audit.status });
    });
  }

  app.get("/research-audits", { preHandler: authenticate }, async (req) => {
    const rows = await scopedDb(req.auth!.organizationId).researchAudits.list();
    return { audits: rows.map(presentAudit) };
  });

  app.get<{ Params: { id: string } }>("/research-audits/:id", { preHandler: authenticate }, async (req, reply) => {
    const db = scopedDb(req.auth!.organizationId);
    const row = await db.researchAudits.findById(req.params.id);
    if (!row) return reply.status(404).send({ error: "not_found", message: "We could not find that audit." });
    const findings = await db.researchAudits.releasedFindings(row.id);
    return { audit: presentAudit(row), findings: findings?.map(({ id, pillar, layer, checkId, result, evidence, sourceUrl, sourceName, fix, effort, points }) => ({ id, pillar, layer, checkId, result, evidence, sourceUrl, sourceName, fix, effort, points })) ?? null };
  });
}
```

- [ ] **Step 4: Wire it into `buildApp`**

In `apps/api/src/app.ts`: add the import beside the reports import:

```ts
import { registerResearchAuditRoutes, type ResearchQueue } from "./routes/research-audits.js";
```

Add `researchQueue?: ResearchQueue` to the options type of `buildApp` (the object type on line 20), and register after the reports routes (line ~46):

```ts
  await registerResearchAuditRoutes(app, opts.researchQueue);
```

Production passes no `researchQueue` until Plan 2, so `POST /research-audits` does not exist in production and the GET routes return empty lists.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @sector/api test -- research-audit && pnpm --filter @sector/api typecheck && pnpm --filter @sector/api lint`
Expected: all PASS, typecheck and lint clean. If `Params` typing on `app.get<{ Params }>` conflicts with the existing Fastify setup, copy the typing style used in `apps/api/src/routes/reports.ts` for `:id` routes.

- [ ] **Step 6: Run the whole API suite**

Run: `pnpm --filter @sector/api test`
Expected: PASS, including `full-report.test.ts` (shares the plan and verification machinery).

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "feat(api): gated research audit routes"
```

---

### Task 5: Release gate (ops script)

**Files:**
- Create: `apps/api/src/lib/research-release.ts`
- Create: `apps/api/src/scripts/research-release.ts`
- Create: `apps/api/test/research-release.test.ts`
- Modify: `apps/api/package.json` (scripts)

**Interfaces:**
- Consumes: `rawDb`, `schema` from `@sector/db`.
- Produces: `releaseAudit(auditId: string): Promise<"released" | "not_found" | "not_in_review">`, the only code that sets `released_at`. CLI: `npm run research-release -- --list` and `npm run research-release -- <auditId>`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/research-release.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { pool, rawDb, schema, scopedDb } from "@sector/db";
import { releaseAudit } from "../src/lib/research-release.js";

const org = crypto.randomUUID();
beforeAll(async () => { await rawDb.insert(schema.organizations).values({ id: org, name: "Release Org" }); });
afterAll(async () => { await pool.query("TRUNCATE organizations CASCADE"); await pool.end(); });

const make = (status: string) => scopedDb(org).researchAudits.create({ siteUrl: "https://r.example.org/", createdBy: "u" })
  .then(async (a) => { if (status !== "queued") await scopedDb(org).researchAudits.update(a.id, { status: status as never }); return a.id; });
const releasedAt = async (id: string) => (await rawDb.select().from(schema.researchAudits).where(eq(schema.researchAudits.id, id)))[0]!.releasedAt;

describe("releaseAudit", () => {
  it("releases an audit that is in review and stamps released_at", async () => {
    const id = await make("in_review");
    expect(await releaseAudit(id)).toBe("released");
    expect(await releasedAt(id)).toBeInstanceOf(Date);
    expect((await scopedDb(org).researchAudits.findById(id))?.status).toBe("released");
  });

  it("refuses audits that are not in review, and leaves them untouched", async () => {
    for (const status of ["queued", "running", "failed"]) {
      const id = await make(status);
      expect(await releaseAudit(id)).toBe("not_in_review");
      expect(await releasedAt(id)).toBeNull();
    }
  });

  it("refuses to release twice", async () => {
    const id = await make("in_review");
    expect(await releaseAudit(id)).toBe("released");
    const first = await releasedAt(id);
    expect(await releaseAudit(id)).toBe("not_in_review");
    expect(await releasedAt(id)).toEqual(first);
  });

  it("reports an unknown id", async () => {
    expect(await releaseAudit(crypto.randomUUID())).toBe("not_found");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @sector/api test -- research-release`
Expected: FAIL, "Failed to load url ../src/lib/research-release.js".

- [ ] **Step 3: Write the release function**

Create `apps/api/src/lib/research-release.ts`:

```ts
import { and, eq } from "drizzle-orm";
import { rawDb, schema } from "@sector/db";

// The only code that sets released_at (specs/2026-10-13-research-audit-design.md, "Review and release").
// Ops-only: it takes a bare audit id, so it is never reachable from a request handler.
export async function releaseAudit(auditId: string): Promise<"released" | "not_found" | "not_in_review"> {
  const done = await rawDb.update(schema.researchAudits).set({ status: "released", releasedAt: new Date() })
    .where(and(eq(schema.researchAudits.id, auditId), eq(schema.researchAudits.status, "in_review")))
    .returning({ id: schema.researchAudits.id });
  if (done[0]) return "released";
  const exists = await rawDb.select({ id: schema.researchAudits.id }).from(schema.researchAudits).where(eq(schema.researchAudits.id, auditId));
  return exists[0] ? "not_in_review" : "not_found";
}
```

- [ ] **Step 4: Write the CLI wrapper**

Create `apps/api/src/scripts/research-release.ts`:

```ts
import "../env.js";
import { desc, eq } from "drizzle-orm";
import { rawDb, pool, schema } from "@sector/db";
import { releaseAudit } from "../lib/research-release.js";

// INTERNAL OPS ONLY. Releases a reviewed research audit so the organization can see it.
//   npm run research-release -- --list        audits waiting for review
//   npm run research-release -- <auditId>     release one
const [arg] = process.argv.slice(2);

if (arg === "--list") {
  const rows = await rawDb.select({ id: schema.researchAudits.id, org: schema.organizations.name, site: schema.researchAudits.siteUrl, overall: schema.researchAudits.overallScore, createdAt: schema.researchAudits.createdAt })
    .from(schema.researchAudits).innerJoin(schema.organizations, eq(schema.organizations.id, schema.researchAudits.organizationId))
    .where(eq(schema.researchAudits.status, "in_review")).orderBy(desc(schema.researchAudits.createdAt));
  for (const r of rows) console.log(`${r.id}  ${String(r.overall ?? "-").padStart(3)}  ${r.org}  ${r.site}  ${r.createdAt.toISOString()}`);
  if (rows.length === 0) console.log("No audits waiting for review.");
} else if (!arg) {
  console.error("usage: research-release <auditId>  |  research-release --list");
  process.exitCode = 1;
} else {
  const result = await releaseAudit(arg);
  console.log(result === "released" ? `Released ${arg}.` : result === "not_found" ? `No audit ${arg}.` : `Audit ${arg} is not in review, so it was not released.`);
  if (result !== "released") process.exitCode = 1;
}
await pool.end();
```

Add to the `scripts` block of `apps/api/package.json`, after `set-plan`:

```json
    "set-plan": "tsx src/scripts/set-plan.ts",
    "research-release": "tsx src/scripts/research-release.ts"
```

- [ ] **Step 5: Run the tests and the full checks**

Run: `pnpm --filter @sector/api test && pnpm --filter @sector/api typecheck && pnpm --filter @sector/api lint`
Expected: all PASS, clean.

- [ ] **Step 6: Smoke-test the script against the local database**

Run: `cd apps/api && npm run research-release -- --list`
Expected: prints `No audits waiting for review.` and exits 0. Then `npm run research-release -- nonexistent` prints `No audit nonexistent.` and exits 1.

- [ ] **Step 7: Run the whole repo's checks**

Run (repo root): `pnpm test && pnpm typecheck && pnpm lint`
Expected: all green.

- [ ] **Step 8: Commit and open the PR**

```bash
git add apps/api
git commit -m "feat(api): ops release gate for research audits"
git push -u origin feat/research-audit-foundation
gh pr create --base main --title "feat: research audit foundation (scoring, tables, gated API, release gate)"
```

PR body: summarise the five tasks; state that migration 0004 is additive; state that nothing creates audits in production yet (no queue is wired until Plan 2); list what was and was not verified (unit and API tests against real Postgres; no production run).

---

## Self-review (completed while writing)

**Spec coverage.** Scoring model and honesty rules 1-4: Task 1. Access rules (plan, verified site, own site, hidden until released): Tasks 3-4. Data model: Task 2, with the two amendments applied. Release half of review: Task 5. Not covered here, by design, and assigned to later plans: pillar rules and crawl, platform detection, JS fallback, Lighthouse and axe (Plan 2); reference library (Plan 3); peers (Plan 4); skills and synthesis (Plan 5); review screen, edits UI, organization tab, PDF, upgrade prompt, operator login (Plan 6). `review_edits` is created now but unused until Plan 6.

**Placeholders.** None. Migration file names are generated, so Task 2 tells the engineer to read the generated SQL instead of showing it.

**Type consistency.** `ScoreFinding.sourceUrl` (Task 1) matches `researchFindings.sourceUrl` (Task 2). `ResearchQueue` is defined in Task 4 and the test passes the same shape. `releaseAudit` return values match the test and CLI. `scopedDb(...).researchAudits` method names are the same in Tasks 3, 4 and 5.

**Known simplification.** `update()` in Task 3 destructures an allow-list so `releasedAt` cannot be written through the tenant-scoped repository; the cast in its test (`as never`) proves a smuggled key is ignored.

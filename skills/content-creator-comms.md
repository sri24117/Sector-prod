# Skill 4: Content Creator for Communications

> **Reconstruction note**: rebuilt from a detailed working summary after the
> original session's local workspace was reset. If a byte-for-byte original
> copy exists on the founder's side, treat that as canonical.

Status: the lowest-external-risk skill in the whole build — it is pure generation, no partner gate, extends the existing `ngo-marcomm-toolkit` rather than replacing it.

## 1. Role and scope

Generates the full range of organizational communications content: press releases, bylined/authored pieces for e-media publications, annual reports, case studies, brochures/leaflets/pamphlets, one-pagers, proposals, and presentation-deck copy — everything relevant to organizational enhancement beyond blog/social (which the existing toolkit already covers).

## 2. How it extends the existing toolkit

Routes every new format through the same brand-voice intake worksheet already validated in `ngo-marcomm-toolkit` (the shared substrate every skill reads from, not a per-skill reimplementation), and through the same citation-discipline pattern used for blog/SEO content.

## 3. Shared gates with Skill 3

- `ConsentRecord`: any case study or named quote featuring a beneficiary requires consent on file before it can be exported or published — identical gate to Skill 3's social content.
- `BrandKit`: word/character budgets sized to a layout (a one-pager vs. a full annual report) read from the same DTCG-compatible token store Skill 5 uses for visual rendering, so copy length and design constraints stay consistent.

## 4. What ships in v1

**Buildable now, no external gate, in full.** This is the one skill with zero partner-approval or paid-tier dependency — it should ship complete in Phase 1, not partially.

## 5. Data model

`ContentAsset`, `ContentPillar` (existing), `ConsentRecord` (shared with Skill 3), `BrandKit` (shared with Skill 5).

## 6. Guardrail

Any generated asset that names or shows a beneficiary is blocked from export/publish without a `ConsentRecord` — this is a pipeline-level gate, not a reviewer reminder.

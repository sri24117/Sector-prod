# Feature: Starter calendar plan draft (1 month, then 3 months)

Status: PROPOSED. Behavior-based unlock confirmed by the founder on 2026-10-31. Everything else below
is a proposal until approved. Nothing is built. Format: MVP Feature Card
(`docs/methodology/AI_ENGINEERING_HANDYBOOK.md` §24). Written 2026-10-31 against `main` at `cd9679c`.

## Goal

Give a Starter organization a ready-made, editable one-month plan for its calendar, so a lone comms
person starts from a plan instead of a blank page. Once they have shown they use it, offer a
three-month view.

## User

The comms generalist at a Starter NGO. Same as `docs/plans/feature-spec-starter-pilot-proof.md`.

## Why

The calendar exists (PR #24) but starts empty. An empty calendar is the likeliest place for a pilot
NGO to stall, and the Starter pilot proof measures exported pieces. A plan that turns into drafts
moves that number.

## Current behavior (read on `main`)

- `GET/POST/PATCH/DELETE /calendar` manage items: date, channel (facebook, instagram, email, website, linkedin), objective (3 to 300 characters), assignee (required), and a linked content asset (`calendar_items.content_asset_id` is NOT NULL, so an item cannot exist without a draft).
- Manual drafts and generated drafts share the 15-pieces-a-month Starter allowance. Edits and repeated exports do not use another piece.
- Exporting sets a piece's status to `exported`; editing it later resets approval to draft.
- No plan suggestions. No record of renewals: invoicing is manual and `organizations.plan` is only a label.

## Desired behavior

1. **Suggest, don't store.** A new read-only endpoint returns a suggested plan for a date range: slots of date, channel, objective and a theme. Nothing is saved until the user takes a slot, so no schema change is needed.
2. **Template, not AI.** Slots come from a fixed, reviewed template (a rotation of objectives such as impact story, thank-you to supporters, volunteer or donation call, event or update, plain-language awareness fact). It works with no AI provider. AI-personalised wording is a later option that depends on the AI quality gate in the Starter pilot spec.
3. **Starter plan draft = 1 month.** About 12 slots (3 a week) across the channels the user picks. This fits inside the 15-piece allowance.
4. **"Use this slot"** opens the existing manual draft form pre-filled with the theme and objective; the user adds the facts, an assignee and the date, saves, and the existing calendar item is created. It consumes one piece, as any draft does. Unused slots cost nothing.
5. **3-month view unlock (behavior-based).** The 3-month view appears once the organization has at least N pieces in status `exported`. The 3-month view extends the planning horizon only; the monthly allowance stays 15. Renewal-based unlock replaces this rule later, when billing records renewals.
6. Plan gating follows the existing `content` feature (Starter and above). Free sees the locked state.

## Acceptance criteria

- [ ] A Starter org gets a one-month suggested plan; a Free org gets 403 `plan_required`.
- [ ] The plan contains no more than 15 slots a month and only channels the calendar supports.
- [ ] Suggesting a plan writes nothing and uses no allowance.
- [ ] Taking a slot creates exactly one draft and one calendar item, both scoped to the organization; another organization cannot see or use them.
- [ ] Below N exported pieces the 3-month request returns a plain message saying how many more are needed; at N or more it returns three months.
- [ ] The behavior works with no AI provider configured.
- [ ] Viewers cannot take slots (existing role rules).
- [ ] The page has an honest empty state and a clear error when the allowance is reached.

## Guardrails

- No schema change, no new table, no new dependency, no billing or renewal logic.
- Nothing publishes or schedules to a platform. This remains a manual-posting plan.
- The template must not invent claims about the organization. Themes are prompts for the user's own facts.
- A beneficiary or story theme still goes through the existing consent check at export.

## Relevant files

- `apps/api/src/routes/calendar.ts`, `apps/api/src/routes/content.ts` (existing endpoints and allowance)
- `apps/web/src/app/calendar/page.tsx`
- `packages/shared/src/plans.ts` (allowance and feature table)

## Risks

- Edits reset a piece from exported back to draft, so counting exported pieces can undercount; acceptable for an unlock rule, and it should be documented.
- A fixed template is generic by nature. It is a starting point; the user's facts make it specific.
- Three months of slots may overwhelm a lone staffer. Keep slots collapsed by month.

## Verification

Tests for the plan endpoint (Starter allowed, Free refused, nothing written, cross-tenant), the unlock threshold, and the take-a-slot flow against Postgres. Then the real journey in the web app: plan, take two slots, edit, approve, export, and see the 3-month offer appear.

## Definition of done

A Starter organization can open a plan, turn slots into drafts and calendar entries, and unlock the three-month view by using it.

## Open decisions (HUMAN DECISION REQUIRED)

1. N, the number of exported pieces that unlocks three months (proposal: 8).
2. Channels offered by default, and the posts-a-week cadence (proposal: 3 a week).
3. The objective rotation in the template, reviewed by someone who knows NGO comms.
4. When billing records renewals, whether the unlock moves to the second renewal as originally requested.

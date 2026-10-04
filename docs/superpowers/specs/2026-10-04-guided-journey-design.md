# Guided journey with soft step cards

Date: 2026-10-04 · Status: approved in conversation (option 2 of 3) · Scope: `apps/web` only

## Intent

The user is the generalist comms person at an Indian NGO (see `apps/web/PRODUCT.md`). They should always know **where they are, what is wrong in plain words, what fixing it is worth, and the one thing to do next**. Selling happens inside that journey: each step shows the value of the next one. There are no banners and no pressure.

Success: a first-time visitor can go from "paste URL" to "first fix applied" without reading instructions, and every screen has exactly one obvious next action.

## Decision

We move from the flat hairline lists in `design.pdf` to **soft rounded cards** for steps, insights and the next action. The rest of the visual system stays as it is: paper, ink, pine and ochre; Newsreader for the score and headlines, Public Sans for everything else; no shadows; the score is still the hero. `apps/web/DESIGN.md` will be updated to record this change, which the product owner approved on 2026-10-04.

## 1. The journey: four steps

| # | Step | Where it lives |
|---|---|---|
| 1 | Check your site | `/` before a result |
| 2 | See what to fix | `/` after a result |
| 3 | Create your account and connect WordPress | `/signup`, and `/audits` while WordPress is not connected |
| 4 | Fix and re-check | `/audits` once connected, and the dashboard |

A **progress strip** (`<JourneySteps current={n} />`) shows on these screens. It has four short labels; past steps are marked done, the current step is in pine, and future steps are muted. It uses `<ol>` with `aria-current="step"`, and on a phone it collapses to "Step 2 of 4: See what to fix".

## 2. Insight cards (replace the findings list)

`<InsightCard>`, one per check, ordered with needs-attention first and then by score weight. Each card shows:

- the plain title (from `lib/checks.ts`), with the drawn mark and the status word
- what we found, in one sentence; for failing checks, why it matters
- **Impact chip**: "+N points", which is the check's weight
- **Effort chip**: a per-check estimate in plain words (see the table), or "We can do it for you" for `schema` when WordPress is connected
- the one action button (the existing fix and manual-steps behaviour, unchanged)
- the crawler's technical detail, small, at the bottom

Passed checks render as compact cards (title, mark, one line) so the page stays short.

| Check | Effort shown |
|---|---|
| schema | "About 10 minutes, or we do it for you on WordPress" |
| robots_txt_ai_block | "About 10 minutes with your web person" |
| llms_txt | "About 15 minutes · low priority" |
| heading_hierarchy | "About 20 minutes" |
| faq_pairs | "About 30–60 minutes of writing" |
| front_loaded_stat | "About 10 minutes" |
| freshness | "About 10 minutes" |

## 3. Value summary card (where selling happens)

This goes on `/` after a result and on `/audits` above the insights:

> **55 out of 100 today. Fixing these 3 could take you to 90.**
> One of them we can fix for you automatically on WordPress.
> [Create an account to fix them] (public) / [Connect WordPress] or [Apply the first fix] (signed in)

The potential is the current score plus the weights of the failing checks. There are no invented numbers.

## 4. "Your next step" card on the dashboard

There is always exactly one action, chosen deterministically:

1. no audits → "Run your first audit"
2. `schema` failing and WordPress not connected → "Connect WordPress (+20 points)"
3. `schema` failing and connected → "Apply your first fix (+20 points)"
4. another check failing → "Fix: <plain title> (+N points)", which links to `/audits`
5. everything passing → "Re-check your site", which keeps the score fresh

Beside it sits a "What changed" line from the last two audits ("Up 10 points since 19 Sep" or "Same score as 19 Sep"). With only one audit, it reads "Run another audit after your fixes to see progress".

## 5. Visual tokens (DESIGN.md change)

- `--radius-card: 12px` for cards; inputs and buttons keep 6px
- card: `background: var(--surface)` (light `#FBFCF9`, dark `#1C221D`), `border: 1px solid var(--line)`, padding 24px (16px under 480px), no shadow
- chips: pill radius, 13px text, `--line` border, ink text (impact chips use a pine border only when the check is the top win)
- card gap 16px; insight cards stack in one column (max 70ch), and the dashboard keeps its 65/35 columns
- keep: WCAG AA (status words in ink), visible focus, reduced motion, and a 360px minimum width

## Out of scope

API, schema and route changes; new features; the Replit-style dark cards and rings; changes to the content and Ad Grants pages beyond adopting the card container for their existing sections.

## Testing

- typecheck, the full test suite, and the Impeccable detector
- screenshots at 1280 and 360px of `/`, `/signup`, `/dashboard` (demo data) and `/audits`; no horizontal overflow
- verify each next-step rule with the demo org's state, and check that the impact and potential numbers match the check weights

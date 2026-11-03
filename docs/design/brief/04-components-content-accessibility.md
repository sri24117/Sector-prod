# SEctOr design brief, part 4: components, content rules, accessibility and Figma setup

## 1. Design direction guardrails

The redesign is a **new** visual design (decision to confirm: part 1, section 7). What must stay true regardless of style:

- **Calm and trustworthy.** An NGO is handing over a website and sometimes credentials. The interface should feel like a careful colleague's working tool, not a vendor's pitch.
- **Plain language first.** The reader is a generalist, not a specialist. Every technical term has a plain version next to it.
- **The score is the hero.** The audit score is the product's defining moment and gets the strongest typographic treatment in the product.
- **Honest status everywhere.** Locked, coming soon, unverified, could not check and not switched on are first-class states with their own design, not error states.
- **Guidance, not alarm.** A failing check is "needs attention". Reserve alarm colours for genuine destructive or failed-payment states, neither of which exists in v1.
- **Phone first.** Many first visits happen on a phone.

**Directions the founder rejected earlier (2026-10-03), for awareness** (the new design may reconsider, but should do so on purpose): a warm cream and terracotta "AI" look; glossy SaaS gradients; urgency timers; stock photography; dark mode with neon "hacker" styling; centred hero cards; card grids; and anything that reads as selling rather than explaining. (The pricing page is the place where this tension is sharpest; see `02-pricing-and-plans.md` section 4.)

## 2. Current visual system (reference, keep or replace)

From `apps/web/DESIGN.md` and `docs/design/design-system.pdf`. Use as a baseline for Figma variables, or discard.

| Token | Light | Dark | Used for |
|---|---|---|---|
| paper | #f6f7f3 | #161b17 | page ground |
| ink | #161b17 | #f6f7f3 | text, score numeral, rules |
| ink-muted | #5b6058 | #a9ada4 | secondary text (about 6:1 on paper) |
| line | #e2e4dc | #2e352f | hairlines and borders |
| pine | #1f4d3b | #4a8a6f | primary actions, links, focus, "passed" |
| ochre | #9c6b1f | #c99445 | "needs attention" marks only |
| surface | #FBFCF9 | #1C221D | card face |

- **Type:** Newsreader (serif) for the score, page headlines and history scores; Public Sans for everything else. Scale: score 72, headline 32, title 20, body 16 (line height 1.6, tabular figures), small 13.
- **Spacing:** 4, 8, 12, 16, 24, 32, 48, 64.
- **Radius:** 6 on controls, 12 on cards, pill on chips and progress, 2 on the focus ring.
- **Layout:** signed-in container 1040; narrow column 560 for the free audit, login and sign-up; page padding 48 / 24 / 64 (top / sides / bottom), tightening to 32 / 16 / 48 under 480; two columns (65 / 35, gap 48) from 880.
- **Depth:** flat, hairlines instead of shadows.
- **Motion:** only the score count-up (about 600 ms, ease-out) with its rule drawing in; respect reduced motion.
- **Dark mode:** secondary; follows the system setting.

## 3. Component inventory

Design each with all listed states. The names match the product's code where one exists.

| Component | Variants | States |
|---|---|---|
| **Button** | primary, quiet, link | default, hover, focus, pressed, disabled, busy ("Saving..."). Minimum height 44. The label says exactly what happens. |
| **Field** | text, email, password, URL, date, month, select, textarea, checkbox | default, hover, focus, filled, error (message in words), disabled, with hint |
| **Score numeral and rule** | large (result), row (history) | count-up (once), static; below and at 70 points and above |
| **Journey strip** | 4 steps | done, current, future |
| **Insight card** | needs attention, passed (compact), could not check | with impact chip, effort chip, action, technical detail |
| **Value summary card** | public, signed in | "55 out of 100 today. Fixing these 3 could take you to 90." |
| **Next-step card** | five fixed variants | exactly one action |
| **Chips** | impact ("+20 points"), effort, status, plan, founding-member | static |
| **Status mark and word** | pass, needs attention, could not check, locked, coming soon | drawn mark plus a word, never colour alone |
| **Message banner** | success, information, needs attention | dismissible and persistent |
| **List row** | history, draft, consent, calendar item, change history | with actions, empty |
| **Tabs** | page tabs; pillar tabs with scores | selected, disabled |
| **Details (accordion)** | four-week plan blocks, FAQ | open, closed |
| **Table** | plan comparison | wide, collapsed per plan on a phone |
| **Code line with copy** | verification line, DNS record | copied confirmation |
| **Locked frame** | locked, coming soon | with one action and a muted "Example" |
| **Meter** | content allowance | within, near limit, reached, no cap |
| **Calendar** | list, week, month grid | item states: draft, ready to post manually, blocked by consent |
| **Slot card** | suggested plan slot | open, planned |
| **Plan badge** | free, starter, growth, pro | in the shell |
| **App shell** | desktop, narrow menu | with locked items visible |
| **Review diff** | old value and new value | before approving a website change |
| **Progress for long jobs** | report, research | queued, running, done, failed; no countdown |
| **PDF page** | A4 report | header, footer with page numbers |

## 4. Status vocabulary (use these words exactly)

| Object | Statuses shown to users |
|---|---|
| Audit check | Passed, Needs attention, Could not check |
| Draft | Draft (waiting for approval), Approved, Exported |
| Calendar item | Draft (needs approval), Ready to post manually, Blocked (consent required), Planned (a slot) |
| Consent record | Active, Revoked |
| WordPress | Not connected, Connected |
| Website change | Verified, Applied but not verified, Restored, Failed |
| Website ownership | Not verified, Verified through <method> |
| Full report | Queued, Running, Done, Failed |
| Research report | Being prepared, Being reviewed, Released, Failed |
| Plan feature | Included, Locked, Coming soon, Not available yet |
| Ad Grants | Not confirmed by SEctOr, Confirmed, Linked, Needs attention |

## 5. Content and voice

**Voice:** a careful, precise colleague. Specific, calm, never hype. Sentence case everywhere (no all capitals, no tracked uppercase).

**Rules**
1. **Buttons say exactly what happens:** "Run free audit", "Apply fix to my WordPress site", "Approve draft". Not "Submit", "Go" or "Get started".
2. **Say what is true.** "Nothing has been scheduled or published." "SEctOr reads your account only and never changes your campaigns."
3. **Never imply verification** of FCRA, PAN, 12A or 80G.
4. **Errors say what happened and what to do,** in words, without blame: "That address can't be connected." "Your website address must start with https://. Turn on HTTPS with your web host, then connect again."
5. **Unavailable is stated plainly:** "Draft generation is not switched on for SEctOr yet. Everything else on this page works."
6. **No invented numbers or proof.** No customers, quotes, case studies or benchmarks exist yet.
7. **No promised dates** for anything coming soon.

**Use and avoid**

| Use | Avoid |
|---|---|
| plan | package, tier, subscription |
| check, finding | issue, error, violation (for an ordinary failing check) |
| needs attention | failed, critical, urgent |
| website address | URL, domain (unless the user must type a DNS value) |
| structured data (with "so search engines can tell who you are") | schema, JSON-LD |
| people featured | beneficiaries (in the interface; the term stays internal) |
| fix | remediation |
| web person | developer |
| coming soon | roadmap, beta |
| Rs 5,999 + GST | Rs.5999, INR 5999, "from" prices |

**Formats:** dates `2 Nov 2026`; "since 19 Sep"; times in IST; money `Rs 1,16,999 + GST` (Indian grouping); percentages as whole numbers; scores out of 100 written "55 out of 100".

**Microcopy to reuse (exists in the product)**
- "Scores appear here after your first audit."
- "Approved changes and their verification outcomes appear here."
- "Not connected. Connecting lets SEctOr apply structured-data fixes to your site and re-check them."
- "Calendar saved. Nothing has been scheduled or published."
- "Your website is verified through <method>. You can now create full reports."

## 6. Accessibility and responsive

**Non-negotiable**
- WCAG 2.2 AA contrast for all text and controls. Muted text must still pass.
- Fully usable at 360 px width. No horizontal scrolling at any width.
- Visible keyboard focus on every interactive element. Touch targets at least 44 px.
- Pass and fail are never conveyed by colour alone: a drawn mark plus a word.
- Respect reduced-motion settings; the score count-up is skipped.
- Forms: visible labels (not placeholders), errors next to the field and summarised, programmatic error association.
- The journey strip and tabs expose their current state to assistive technology.
- Tables have header cells; the plan comparison has a text-only alternative on narrow screens.
- Language is set per page. If Hindi or other languages are added, plan for longer strings and non-Latin type.

**Breakpoints (reference):** 360 (minimum), 480 (tighten padding), 768, 880 (two columns), 1040 (container), 1280 (design canvas).

**Low bandwidth:** self-hosted fonts, no large images, no autoplay, no heavy third-party scripts. Prefer drawn marks to image icons.

## 7. Data the screens show (so wireframes carry real fields)

| Object | Fields to design for |
|---|---|
| Audit | url, date, score 0 to 100, seven checks each with weight, status, plain explanation, technical detail |
| Full report | status, website, date, overall score, area scores, pages checked, coverage notes, action plan (do first, this month, later), could-not-check list, PDF |
| Research report | status, website, platform, overall score, four pillar scores, findings (pillar, statement, evidence quote, source, result), could-not-check list, brand direction summary, release date |
| Draft | kind, title, text, source facts, people featured, status, revision, created by, date |
| Consent record | person, scope (story, quote, photo, everything), how given, date, status |
| Calendar item | date, channel, objective, responsible person, linked draft, derived status |
| Suggested slot | date, channel, objective, hint |
| Website change | target site, old value, new value, before score, after score, outcome |
| Organization | name, type, website, PAN, FCRA self-declared, FCRA confirmed (by SEctOr, with date), plan |
| Plan | name, price, availability, included features, content allowance and use |

## 8. Figma setup

1. **Pages:** `00 Cover and rules`, `01 Flows`, `02 Public`, `03 App`, `04 Planned and coming soon`, `05 Internal`, `06 Components`, `07 Tokens`.
2. **Variables:** build colour, type, spacing and radius variables from section 2 (or the new system), with light and dark modes.
3. **Frames:** every screen at 360, 768 and 1280, named `<ID> <name> / <width>` (for example `A07 Full report / 360`). Put each state as its own frame next to the default.
4. **Components:** build section 3 first, with all states as variants.
5. **Prototype the flows** F1 to F8 from part 1 so the failure branches can be clicked through.
6. **Annotate** each frame with its screen id so engineering can map it back to `03-screen-specs.md`.

## 9. Prompt template for wireframe generation

Paste one screen at a time. Template:

```
Design a wireframe for the screen below, at <360 | 768 | 1280> px width. Low fidelity: grayscale, real text
(no lorem ipsum), clear hierarchy, one primary action. Include every listed state as a separate frame.
Do not add features, numbers, testimonials or claims that are not in the spec.

<paste one screen spec from 03-screen-specs.md>

Rules: sentence case; buttons say exactly what happens; status shown as a mark plus a word; Rs prices with
"+ GST"; never imply FCRA verification; nothing is ever shown as scheduled or published.
```

Start with P01, A01, A07, A08, A12 and P02, since they carry the product's main moments.

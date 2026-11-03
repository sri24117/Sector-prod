# SEctOr design brief, part 1: product, users, information architecture and flows

Written 2026-11-03 against `main` at `cd9679c` plus open work (PRs #25 and #29). This brief is the input
for a complete redesign of the SEctOr web app. It describes **what the product does and must say**, not
how it should look. Status labels are used everywhere, so a designer never draws a screen that implies
a feature which does not exist.

## 0. How to use this brief in Figma

1. Read this file and `04-components-content-accessibility.md` first. They are the rules.
2. Build the screens from `03-screen-specs.md`, one Figma page per group (Public, App, Planned, Internal).
   Screen ids (`P01`, `A07`, ...) are stable; use them as frame names. `screens.csv` lists all of them for import.
3. Build the pricing page and the locked states from `02-pricing-and-plans.md`.
4. To generate first-draft wireframes with Figma's AI, paste **one screen spec at a time** (each is
   self-contained: purpose, regions, components, data, states, copy). Do not paste the whole brief at once.
5. Design every screen at three widths: **360, 768 and 1280**. Phone first (see section 2).
6. Every screen needs all its listed states, not just the happy path. The states are where this product's
   trust is won or lost.

### Status legend

| Label | Meaning |
|---|---|
| BUILT | Works on `main` today |
| IN REVIEW | Code exists in an open pull request |
| SPECIFIED | A written spec exists, nothing is built |
| PROPOSED | New in this brief, needs a founder decision |
| COMING SOON | Not built. Shown to users as "coming soon", never as working |

## 1. The product in one page

**SEctOr** (always written exactly like this) helps Indian NGOs, CSR teams, foundations and social
enterprises become visible in search engines and AI assistants, without an in-house marketing team.

**The promise: execution instead of advice.** A visitor pastes a website address and, within seconds,
gets a 0 to 100 visibility score with a plain-language breakdown. Signed-in organizations can have a
supported fix applied to their own WordPress site and re-checked, rather than receiving a to-do list.

**What exists today (BUILT):**
- A free audit (no sign-in) scoring seven checks: structured data, AI-crawler access, a summary file for AI tools, headings, common questions, a number near the top, and freshness signals.
- Accounts for organizations, with three roles: owner, staff, viewer.
- A signed-in audit history and a guided journey from "paste URL" to "first fix applied".
- Live WordPress fix (structured data only): connect, review the change, approve, apply, re-check, restore.
- A paid **full report** (search and AI visibility, website health, accessibility, social links, action plan, PDF).
- **Content**: brand voice, consent records, drafts you write yourself or generate (generation is switched off until an AI provider is configured), human approval, and export that is blocked without consent.
- A manual **content calendar** (dates, channels, objectives, a named person, a linked draft). It never publishes anything.
- **Ad Grants** monitoring, alert-only, behind a confirmed-FCRA gate and a Pro plan. Live data waits for Google's API approval.
- Plans: Free, Starter, Growth, Pro, enforced everywhere. See part 2.

**What is coming (do not draw as working):** a four-tab research report (SEO, AI visibility, UI/UX,
content and brand) [IN REVIEW, engine only], a suggested calendar plan [IN REVIEW], the Researcher
(grants and tenders watchlist), automatic social posting, image generation, a periodic human review.

### Product principles (from the existing product definition, keep)

1. **Trust before persuasion.** Every screen should make handing over a website or credentials feel safe and competent.
2. **The score is the moment.** The audit result is the product's defining interaction.
3. **Never half-finished.** An unbuilt or gated capability is stated as unavailable, never implied.
4. **Guidance, not alarm.** A failing check is something to fix, not an emergency.
5. **One obvious next action** on every screen.

### Things the interface must never do

- Imply that SEctOr has **verified** an organization's FCRA, PAN, 12A or 80G. These are self-declared. Only the FCRA confirmation done by SEctOr's ops team unlocks Ad Grants, and the screen must say that it is SEctOr that confirms.
- Show customers, testimonials, case studies, benchmarks or numbers that do not exist. There are none yet.
- Say or show that anything is **scheduled or published**. The calendar plans manual posting only.
- Tease an Ad Grants benefit to an organization whose FCRA status is not confirmed.
- Use urgency timers, fake scarcity, or alarm colours for ordinary failing checks.

## 2. Users

### Primary: the generalist comms person (call them Asha)
Often the only communications or marketing person at a mid-size to upper-grassroots NGO. Not an SEO or
ad specialist, usually without a web developer. Frequently opens an audit link **on a phone** first, often
late after a funder asks "why can't people find us?". Wants plain words, a clear next step, and proof
that a fix worked. Works in English; other languages are an open decision (section 8).

### Secondary: the director or founder (call them Rajan)
Approves what gets published and any money spent. Reads a result once, on a phone or in a PDF. Needs the
score, what it is worth, what it costs, and who is responsible. Rarely edits anything.

### Role in the product: owner, staff, viewer

| Capability | Owner | Staff | Viewer |
|---|---|---|---|
| Read everything the plan allows | yes | yes | yes |
| Run audits, create drafts, plan posts, request reports | yes | yes | no |
| Apply WordPress fixes, record consent, export content | yes | yes | no |
| Link the Google Ads account (Ad Grants) | yes | no | no |

There is **no invitation flow yet**, so in practice every account is an owner. Design role-aware states
(disabled or hidden controls with an explanation), but do not design an invite screen as built.

### Internal: SEctOr's ops team
Sets plans after invoicing, confirms FCRA, issues password-reset links, releases reviewed research audits
and watches pilot numbers. All of this is done by command-line scripts today. A designed internal console
is PROPOSED (screen `I01`) and is the lowest priority.

### Context to design for
- **Phone first and slow networks.** The audit result must be readable on a 360 px screen. No horizontal scrolling.
- **India:** dates as `2 Nov 2026`, all times in India Standard Time (Asia/Kolkata), money as `Rs 1,16,999` (Indian digit grouping) and always "+ GST".
- **No email system in the product today.** Never design "we have emailed you" states. Password-reset links are currently issued by ops.
- **Not a mobile app, not a CRM, not a billing system.** These are explicit non-goals.

## 3. Information architecture

### Sitemap

```
PUBLIC (no sign-in)
  /                     P01  Free audit (form -> running -> result)          BUILT
  /pricing              P02  Plans and pricing                                PROPOSED
  /signup               P03  Create your organization account                 BUILT
  /login                P04  Log in                                           BUILT
  /forgot-password      P05  Forgot password                                  BUILT
  /reset-password       P06  Set a new password                               BUILT
  /privacy  /terms      P07  Privacy Policy, Terms of Service (draft)         BUILT

APP (signed in; plan and role decide what is open)
  /dashboard            A01  Overview                                         BUILT
  /audits               A02  Audits: history, results, WordPress, full report BUILT
     A03 Insight cards   A04 WordPress connection   A05 Review a website change
     A06 Website change history   A07 Full report
  /content              A08  Content: drafts, consent, brand voice            BUILT
     A09 Draft editor   A10 Consent records   A11 Brand voice
  /calendar             A12  Content calendar                                 BUILT
     A13 Suggested plan                                                      IN REVIEW
  /ad-grants            A14  Ad Grants (Pro, FCRA-confirmed)                  BUILT
  (any locked feature)  A15  Locked feature state                             BUILT
  /account              A16  Organization profile and website                 PROPOSED
  /plan                 A17  My plan and how to upgrade                       PROPOSED
  /research             A18  Website research: four tabs                      IN REVIEW (engine only)
  /researcher           A19  Researcher: grants and tenders                   COMING SOON
  /social               A20  Automatic posting                                COMING SOON

INTERNAL (SEctOr ops only)
  I01  Ops console                                                            PROPOSED
```

### Navigation model

- **Public:** a wordmark and a short top bar: `Pricing`, `Log in`, and a primary `Run free audit`.
- **App shell (today):** wordmark, organization name, the user's name and role, `Log out`, and a text nav:
  `Overview · Audits · Calendar · Ad Grants · Content`. The redesign may regroup these, but must keep
  the plan status visible somewhere in the shell (for example a small plan badge) and keep locked
  items **visible** with a lock mark, so people can see what upgrading would give them.
- **Suggested regrouping for the redesign (PROPOSED):** `Overview · Website (audits, report, research) · Content (drafts, calendar) · Grants · Account`.
- Every signed-in screen has one primary action, always in the same region.

## 4. Core flows

Each flow lists the screens it crosses. Design the flow end to end, including its failure branches.

### F1. Free audit to account (the funnel)
`P01 form` -> running (a few seconds) -> `P01 result` with a **value summary** ("55 out of 100 today. Fixing
these 3 could take you to 90.") -> `P03 signup` -> `A01 dashboard`.
Failure branches: address not reachable; address blocked (private or invalid); service busy ("try again in a minute"); the site renders with scripts and may be under-scored (the result must say so).

### F2. Sign-up and onboarding
`P03`: organization name, website, type (NGO or charity, CSR team, foundation, social enterprise), work
email, your name, password, PAN, an "FCRA registered" self-declaration checkbox, and **required**
agreement to Terms and Privacy. (12A and 80G numbers are stored but have no screen yet.) -> `A01` with a "your next step" card.
Failure branches: email already registered (plain message, rate limited); weak password; terms not accepted.

### F3. Connect WordPress and apply the first fix
`A02` (not connected) -> `A04` connect (site address, username, application password; https only) ->
back to `A03` -> `A05` review the change (target site, old value, new value, a warning to check
existing SEO-plugin schema) -> approve and apply -> automatic re-check -> `A06` history shows the
outcome -> optional restore of the previous value.
Outcomes to design: **verified** ("Change saved and structured data detected on re-check"), **applied but
unverified** ("Change saved; public verification is incomplete. Check your site before applying anything else"),
**failed** (nothing changed), **unknown** (never retry blindly; tell the user to check). Connecting needs
an https address and the companion plugin; each failure has its own plain message.

### F4. Full report (Starter and above)
`A07`: add your website, then verify you own it (automatic if WordPress is connected, or add a line to the
homepage, or add a DNS record that can take up to an hour; then press Check) -> "Create your first full report" ->
running (2 to 4 minutes, up to 10 a day, up to 20 pages read) -> done: summary, areas, action plan, PDF
download -> or failed ("The last report could not finish"). Changing the website means verifying again.

### F5. Write, approve and export content
`A08` -> `A09` write or paste a draft (kind, topic or title, source facts, people featured, text) -> save
-> review -> **approve** (human step, required) -> export/download. Export is **blocked** if a named
person has no active consent (`A10`), with a plain message naming who. Editing an approved draft sends
it back to draft. Generation by AI is a separate path that says "not switched on yet" until configured.

### F6. Plan posts on the calendar
`A12` (month view) -> `A13` suggested plan (12 slots for four weeks; a three-month view after 8 exported
pieces) -> "Plan this" -> if no draft exists, write one (F5) and come back with the slot kept -> save the
calendar entry. A calendar entry shows **Draft**, **Ready to post manually** or **Blocked: consent required**.
Nothing is ever scheduled or published.

### F7. Hit a locked feature
Any locked feature shows `A15`: what it is, which plan includes it, and one action. Starter is by manual
invoice ("Contact SEctOr to upgrade"). Growth and Pro are a founding-member waitlist ("Join the
founding-member waitlist"). Never a dead end and never an error tone.

### F8. Ad Grants (Pro)
Not FCRA-confirmed -> `A14` explains that SEctOr confirms FCRA by checking the certificate; no teaser of
benefit. Confirmed and Pro -> link the Google Ads customer ID (owner only) -> compliance checks ->
alerts. The product reads the account and **never changes campaigns**. Live data is pending Google approval;
say so plainly.

### F9. Forgot and reset password
`P05` (enter email) -> a neutral confirmation (no sign that the address exists) and a note that SEctOr's team
will send the link -> `P06` (new password) -> `P04`.

### F10. Research report (IN REVIEW, then PROPOSED screens)
Request on `A18` (own verified website, paid plan) -> "being prepared, this can take a while" -> the
owner of SEctOr reviews it -> **released** -> four tabs with scores. Before release the organization sees
only "Your audit is being reviewed". See part 3, `A18`.

### F11. Ops: release and plan changes (PROPOSED, internal)
Invoice -> set plan -> confirm FCRA -> release a reviewed research audit. Today all by command line.

## 5. Measuring success (informs the dashboard, not a UI to build)

- Top-level: of audited organizations, how many take a real next step (connect WordPress, sign up).
- Per organization: score change per applied fix; pieces exported; fixes verified.
- A design must make these **observable**: a before and after score is always shown next to a fix.

## 6. Constraints the design cannot change

- FCRA gate before any Ad Grants surface. DPDP: SEctOr is likely a processor; each NGO is the fiduciary. A beneficiary photo, name or quote cannot be exported without a consent record.
- Human approval before export. AI output never becomes an action by itself.
- Every list and detail screen is **per organization**: never show another organization's data, and never design a switcher between organizations (one account, one organization).
- The Ad Grants module never renders for an unconfirmed organization, with no teaser.

## 7. Open design decisions (HUMAN DECISION REQUIRED)

1. Languages: English only for now, or Hindi and other languages in the first redesign?
2. Replace or evolve the current visual system (`apps/web/DESIGN.md`, `docs/design/design-system.pdf`, recorded as binding on 2026-10-03)? This brief assumes a **new** design and treats the current tokens as a reference, not a rule.
3. How a visitor asks for a Starter invoice or joins the waitlist (a form, an email address, WhatsApp). No contact channel is defined in the repo.
4. Whether `P02 Pricing` is public before the first pilot buyers are signed.
5. Whether the research report replaces the full report later, or both stay.
6. Whether team invitations are part of the redesign scope.

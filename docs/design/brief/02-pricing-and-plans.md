# SEctOr design brief, part 2: pricing and plans

Source of truth: `docs/product/product.md` "Pricing and plans" (confirmed by the founder 2026-10-28) and
`packages/shared/src/plans.ts` (the one table the app enforces). If this file and those disagree, they win.

## 1. The plans

Prices are in rupees, **exclusive of 18% GST**, and are always written "+ GST". Use Indian digit grouping.

| Plan | Monthly | Annual (about 25% off) | Availability |
|---|---|---|---|
| **Free** | Rs 0 | Rs 0 | Open to everyone. The public audit needs no sign-in. |
| **Starter** | Rs 5,999 + GST | Rs 53,999 + GST | Launched. Set by SEctOr after a manual invoice. |
| **Growth** | Rs 12,999 + GST | Rs 1,16,999 + GST | **Founding-member waitlist.** Assigned by hand. |
| **Pro** | Rs 21,999 + GST | Rs 1,97,999 + GST | **Founding-member waitlist.** Assigned by hand. |

"Three-tier pricing" means **Starter, Growth and Pro**, plus the Free plan as the front door (four plans in
code). Founding members keep their price for 12 months.

**There is no checkout.** Payment is by manual invoice (ADR-0006). The product has no billing system, no
card form and no automatic renewal. Every "buy" action is a request to SEctOr, never a payment.

Each plan includes everything in the plan before it. **Pro is everything that is live, including new
features as they ship.**

## 2. What each plan includes

Legend: **Yes** works today. **Locked** exists but is not in the plan. **Coming soon** is not built.

| Feature | Free | Starter | Growth | Pro |
|---|---|---|---|---|
| Free audit score and findings (public audit, no sign-in) | Yes | Yes | Yes | Yes |
| Signed-in audit history, the guided journey, manual fix steps | Yes | Yes | Yes | Yes |
| Full report: search and AI visibility, website health, accessibility, social links, action plan, PDF | Locked | Yes | Yes | Yes |
| Live WordPress fix (connect, review, approve, apply, re-check, restore) | Locked | Yes | Yes | Yes |
| Brand voice, consent records, content drafting and export | Locked | Yes, 15 pieces a month | Yes, no cap yet | Yes, no cap yet |
| Manual content calendar, and the suggested plan | Locked | Yes | Yes | Yes |
| Four-tab research report (SEO, AI visibility, UI/UX, content and brand) | Locked | Planned, plan to be decided | Planned | Planned |
| Researcher: grants and tenders watchlist | None | None | Coming soon | Coming soon |
| Automatic posting to social platforms | None | None | Coming soon | Coming soon |
| Ad Grants monitoring (link account, compliance checks, alerts) | Locked | Locked | Locked | Yes, once FCRA is confirmed and Google approves access |
| Periodic human review by the SEctOr team | None | None | None | Coming soon |

### What this means for honesty (read before drawing the pricing page)

- **Today, Growth and Pro add almost nothing that is live on top of Starter.** Growth's extras are all
  "coming soon". Pro's headline feature, Ad Grants, needs two things that are not done: SEctOr confirming
  the organization's FCRA registration, and Google approving SEctOr's access. The pricing page must say this
  in plain words next to those plans, not hide it in a footnote.
- The reason to join Growth or Pro now is the **founding-member price lock and early access**, not features.
- **Never show report counts.** There is no monthly limit on full reports. (A daily request limit exists
  and is shown only where it matters: "Up to 10 a day".)
- **The only metered feature is generated content.** Starter: 15 pieces a month (calendar month, India time).
  Writing a draft yourself uses a piece too. Editing and re-downloading do not. Growth and Pro caps are
  undecided; show "No cap yet", never a number.
- The three-month calendar view is not a plan feature. It opens by use (after 8 exported pieces).
- The a-la-carte prices (single skills sold separately) are recorded but **not built**. Do not design a
  "buy one skill" flow. They may appear only as a reference line: "Skills are not sold separately yet".

## 3. How plans appear inside the app

### 3.1 Plan badge
Always visible in the app shell: `Free`, `Starter`, `Growth` or `Pro`. A small, quiet label. Clicking it
opens `A17 My plan`.

### 3.2 Locked and coming-soon states (screen `A15`, reused on every gated feature)
One pattern, used everywhere. It has four parts:

1. The feature's name and one sentence on what it does.
2. A line that names the plan: "The full report is part of the Starter plan."
3. **One** action that fits the plan: for Starter, `Contact SEctOr to upgrade`; for Growth or Pro,
   `Join the founding-member waitlist`.
4. A short preview of what the feature shows (a muted example), clearly marked "Example".

Tone: informative, never an error, no red, no padlock-as-punishment. The user did nothing wrong.
"Coming soon" features use the same frame with "Not available yet" in place of the action, and an optional
"Tell us you want this" control (PROPOSED).

Exact wording that exists in the product today:
- "The full report is part of the Starter plan. Contact SEctOr to upgrade."
- "Growth and Pro are a founding-member waitlist: contact SEctOr to join."
- "Google Ad Grants tools open once SEctOr has confirmed your organization's FCRA registration."

### 3.3 Where the lock appears (plan gating matrix)

| Screen or feature | Free | Starter | Growth | Pro | Notes |
|---|---|---|---|---|---|
| `P01` Free audit | open | open | open | open | Never gate. |
| `A01` Overview, `A02` Audits, `A03` insight cards | open | open | open | open | |
| `A04` to `A06` WordPress connect, fix, history | locked | open | open | open | Needs https and the companion plugin. |
| `A07` Full report | locked | open | open | open | Needs a verified website. |
| `A08` to `A11` Content | locked | open | open | open | Allowance applies to generated and manual drafts. |
| `A12`, `A13` Calendar | locked | open | open | open | |
| `A14` Ad Grants | locked | locked | locked | open | Also needs confirmed FCRA. Never teases. |
| `A18` Research report | locked | plan to decide | | | |
| `A19` Researcher, `A20` Posting | | | coming soon | coming soon | |

Read-only roles: a `viewer` sees the same screens as the plan allows but cannot create, apply or export.

### 3.4 Content allowance meter (PROPOSED)
On `A08`, a small meter: "9 of 15 pieces used this month. Resets on 1 December." At the limit: "You have used
your 15 pieces this month. The allowance resets on 1 December. Contact SEctOr if you need more." Growth and
Pro show "No cap yet".

## 4. The pricing page (screen `P02`, PROPOSED)

No pricing page exists today. The brief for it:

**Purpose:** let a comms person and a director see what each plan costs and does, understand honestly what
is live, and take one low-pressure next step.

**Design tension to resolve on purpose:** the earlier design system rejected card grids and anything that reads
as selling rather than explaining. A row of four plan cards is a card grid. The designer may choose a
comparison table as the main structure, with plan columns, instead of cards, as long as every rule below holds.

**Structure (top to bottom):**
1. **Header.** Headline in plain words, for example "Plans for NGOs". One line: "Prices are in rupees and do not include 18% GST. You pay by invoice."
2. **Billing toggle.** Monthly | Annual (about 25% off). Default Monthly. Show both prices; never hide the monthly one.
3. **Plan cards,** left to right: Free, Starter, Growth, Pro.
   Each card: name; price with "+ GST"; the one-line audience; a short "Live today" list; a short "Coming soon" list (muted); a status chip; one action.
   - Free: chip `Open to everyone`. Action `Run free audit` -> `P01`.
   - Starter: chip `Available now`. Action `Ask for an invoice`.
   - Growth: chip `Founding-member waitlist`. Action `Join the waitlist`.
   - Pro: chip `Founding-member waitlist`. Action `Join the waitlist`.
   Starter is visually emphasised only because it is the plan that works fully today, not as a sales trick. No "most popular" badge: no data supports it.
4. **Honest line under Growth and Pro:** "Growth and Pro start with the same working tools as Starter. Their extra features are coming soon and are marked. Founding members keep today's price for 12 months and get new features as they ship."
5. **Comparison table.** The matrix in section 2, with Yes, Locked and Coming soon shown by a drawn mark plus a word. Never colour alone.
6. **What is metered.** A short block: "Generated content: 15 pieces a month on Starter. There is no limit on audits or full reports."
7. **FAQ** (wording proposed; answers marked * need a founder decision before publishing):
   - Do the prices include GST? No; 18% GST is added on the invoice.
   - How do I pay? By invoice from the SEctOr team. There is no card payment.
   - Can I try before I pay? Yes: the free audit and the free plan.
   - What about our FCRA registration? Ad Grants tools open after SEctOr confirms it; FCRA details you enter are not verified by SEctOr when you sign up.
   - What happens to our data? Link to Privacy and the data-processing terms.
   - Can I cancel or change plan? *
   - Is there a discount for small NGOs or annual payment? Annual is about 25% lower. *
   - Do you sell single features? Not yet.
8. **Closing action.** Repeat `Run free audit`.

**Request flow for Starter, Growth and Pro (`P02a`, PROPOSED):** a short form, not a checkout.
Fields: organization name, work email, your name, which plan, a free-text note. Success: "Thanks. The SEctOr
team will contact you to arrange the invoice." HUMAN DECISION REQUIRED: the channel (form, email,
WhatsApp). Do not design a payment step.

**Do not include:** customer logos, testimonials, "trusted by", fake counters, countdowns, "limited seats".
None of these exist and PRODUCT.md forbids fabricating them.

## 5. `A17` My plan (PROPOSED)

A signed-in screen showing: the current plan and, for Growth and Pro, "Founding member: price locked until
<date>" if ops records it (HUMAN DECISION: no such date is stored today); what is included and what is
locked, using the same matrix; the content meter; the most recent change by SEctOr; and one action
`Contact SEctOr to change your plan`. No billing history is shown because none is stored.

## 6. Copy rules for money and plans

- Always "Rs 5,999 + GST". Write "Rs" not the symbol. Annual: "Rs 53,999 + GST a year".
- Say "plan", not "package", "tier" or "subscription".
- Never write "unlimited". Write "no limit on audits and full reports" or "No cap yet".
- Never write "free trial". The Free plan is permanent.
- Never promise dates for coming-soon features. "Coming soon" or "once platform approvals clear".
- Never imply automatic renewal or card billing.

## 7. Open decisions (HUMAN DECISION REQUIRED)

1. The request channel for plan requests and the waitlist.
2. Cancellation and plan-change terms, and any small-NGO discount, before the FAQ is published.
3. Whether the research report belongs to Starter or a higher plan.
4. Growth and Pro content allowances (undecided until real AI cost is known).
5. Whether a founding-member lock date is recorded and shown.

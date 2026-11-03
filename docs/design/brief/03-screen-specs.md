# SEctOr design brief, part 3: screen specifications

Every screen below is self-contained, so it can be pasted into Figma on its own. Read parts 1, 2 and 4 for the
rules (statuses, plans, components, copy, accessibility) that apply to all of them.

**Template for each screen:** purpose, route and status, who sees it, regions top to bottom, components,
data shown, actions, states, copy. Copy marked "(exists)" is in the product today; the rest is proposed.

**Global rules for every screen:**
- Design at 360, 768 and 1280 px. One primary action per screen.
- Always draw: default, loading, empty, error and (where relevant) locked and read-only states.
- Pass or fail is a drawn mark **plus a word**, never colour alone.
- Dates `2 Nov 2026`, times in IST, money `Rs 5,999 + GST`.

---

# GROUP P: public screens (no sign-in)

## P01 Free audit

- **Route** `/`. **Status** BUILT. **Everyone**, no sign-in. Narrow reading column.
- **Purpose:** a visitor pastes their website and sees a score and what to fix, in seconds. The score is the moment.
- **Regions:**
  1. Top bar: wordmark, `Pricing`, `Log in`.
  2. Headline (exists): "How visible is your organization to search and AI assistants?" One supporting line: "It takes a few seconds and shows exactly what to fix, in plain words." (exists)
  3. Form: one field `Your website address`, one button `Run free audit`.
  4. After a result: the journey strip (step 2 of 4), the score, the value summary card, the insight cards, a closing action.
- **Journey strip (4 steps):** 1 Check your site, 2 See what to fix, 3 Create your account and connect WordPress, 4 Fix and re-check. Past steps marked done, current step emphasised, future muted. Ordered list with a "current step" marker for assistive technology.
- **Score:** a very large numeral 0 to 100 that counts up once from zero (about 600 ms) while a thin rule beneath it draws in. It is the only orchestrated motion in the product. The rule is neutral below 70 and in the accent colour at 70 and above ("good" threshold 70).
- **Value summary card (exists):** "55 out of 100 today. Fixing these 3 could take you to 90." Then "One of them we can fix for you automatically on WordPress." Then the action `Create an account to fix them`. The potential is the current score plus the weights of the failing checks; no invented numbers.
- **Insight cards**, one per check, needs-attention first, then by weight. Passed checks are compact (title, mark, one line).
  Each full card: plain title, status mark and word, one sentence on what was found, why it matters (failing only), an **impact chip** ("+20 points"), an **effort chip**, the one action, and small technical detail at the bottom.
- **The seven checks** (weight in points, plain title, effort chip):

| Check | Weight | Plain title | Effort chip |
|---|---|---|---|
| Structured data | 20 | Search engines can tell who you are | About 10 minutes, or we do it for you on WordPress |
| Common questions | 20 | Common questions, answered | About 30 to 60 minutes of writing |
| AI crawlers allowed | 15 | AI assistants are allowed to read your site | About 10 minutes with your web person |
| Headings | 15 | Clear page headings | About 20 minutes |
| Number near the top | 15 | Your impact in numbers, near the top | About 10 minutes |
| Freshness | 10 | Signs the page is kept up to date | About 10 minutes |
| Summary file for AI tools | 5 | A summary file for AI tools | About 15 minutes, low priority |

- **Caveat line (required):** the audit reads the page's HTML only; sites that build their pages with scripts may score lower than they deserve. Say it near the score, in small muted text.
- **States:**
  - Default (form only). Running: the button becomes "Checking your site..." with a calm progress indication; no countdown.
  - Result (above). Result with all checks passing: "Every check passes. Sites change over time, so run an audit now and then to keep it that way."
  - Errors: not a valid address; address cannot be checked (private or blocked); site did not answer; service busy ("Try again in a minute"); too many tries from this connection.
  - Never an alarm tone. A failing check is "needs attention".
- **Actions:** `Run free audit`; per card the one fix action or `See the steps`; `Create an account to fix them`.

## P02 Pricing

- **Route** `/pricing`. **Status** PROPOSED. Full specification in `02-pricing-and-plans.md` section 4.
- **Regions:** header and billing toggle; four plan cards; honest line under Growth and Pro; comparison table; metered-feature note; FAQ; closing `Run free audit`.
- **States:** monthly (default) and annual toggle; narrow layout stacks the cards and moves the comparison table to a per-plan accordion; the waitlist and invoice request form (`P02a`) as an overlay or page.
- **Rules:** "+ GST" on every price; no testimonials or counters; chips say `Open to everyone`, `Available now`, `Founding-member waitlist`.
- **Design tension:** the earlier system rejected card grids; a comparison table as the main structure is an allowed alternative to four cards.

## P02a Plan request

- **Route** an overlay or page opened from `P02`. **Status** PROPOSED. **Everyone**, no sign-in. Not a checkout.
- **Purpose:** ask SEctOr for a Starter invoice, or join the Growth or Pro founding-member waitlist. Nothing is paid or charged here.
- **Fields:** Organization name; Work email; Your name; Which plan (Starter, Growth, Pro); an optional note.
- **Copy:** a line above the form, "You pay by invoice. SEctOr's team will contact you; nothing is charged now." Success: "Thanks. The SEctOr team will contact you to arrange the invoice."
- **Action:** `Send request`.
- **States:** default; field errors; submitting; success; could not send ("Could not send your request. Try again.").
- **HUMAN DECISION REQUIRED:** the channel and where requests go. No contact channel is defined in the repository, so this screen is a placeholder for whichever is chosen (a form, an email address or WhatsApp).

---

## P03 Create account

- **Route** `/signup`. **Status** BUILT. Narrow column.
- **Purpose:** an organization creates an account and its owner login.
- **Heading** (exists): "Create your organization account".
- **Section "Registration details"** (exists) fields: Organization name; Organization website; Type of organization (NGO or charity, CSR team of a company, Foundation, Social enterprise); PAN number; `FCRA registered` checkbox (self-declaration); then Your name; Work email; Password (at least 10 characters).
- **Agreement:** required checkbox "I agree to the Terms of Service and Privacy Policy" with both linked.
- **Helper copy:** state clearly that FCRA and PAN are **entered by the organization and are not verified by SEctOr at sign-up**.
- **Primary action:** `Create account`.
- **States:** default; field errors (inline, with a message in words); email already registered; password too short; terms not accepted; too many attempts; submitting; success goes to `A01`.
- **Link:** `Log in` for existing users.

## P04 Log in

- **Route** `/login`. **Status** BUILT. Narrow column.
- **Fields:** Email, Password. **Actions:** `Log in` (primary); links `Forgot your password?` and `Create one` (exists). Footer links to Privacy and Terms.
- **States:** default; wrong details (one message that does not say which was wrong); too many attempts; submitting.

## P05 Forgot password

- **Route** `/forgot-password`. **Status** BUILT.
- **Copy (exists):** "Enter the email you signed up with. SEctOr will send you a link to choose a new password."
- **Field:** Email. **Action:** `Send reset link`.
- **Truth note:** the product has no email system; SEctOr's team issues the link. The confirmation must be neutral and must not reveal whether the address exists, for example "If that address has an account, SEctOr will send a link." Error (exists): "Could not send the request. Try again."

## P06 Set a new password

- **Route** `/reset-password?token=...`. **Status** BUILT.
- **Heading** (exists): "Choose a new password". **Hint** (exists): "At least 10 characters. You will be signed out on every other device."
- **States:** valid link; missing or expired link (exists): "This page needs the reset link SEctOr sent you. Open the link again, or ask for a new one."; error (exists): "Could not change your password. Try again."; success returns to `P04` with "Your password is changed. Log in."
- **Privacy:** the reset link carries a token in the address; the page must not load third-party content.

## P07 Privacy Policy and Terms of Service

- **Routes** `/privacy`, `/terms`. **Status** BUILT (text is a draft pending legal review).
- Long-form reading layout: a left-aligned column up to about 70 characters wide, a table of contents on wide screens, clear heading levels, a last-updated date, a link back. No marketing chrome.

---

# GROUP A: signed-in app

**App shell (all A screens):** wordmark; organization name; user name and role; plan badge; `Log out`; navigation
(today: Overview, Audits, Calendar, Ad Grants, Content). Locked items stay visible with a lock mark. Narrow
screens use a compact menu. The shell also hosts the global message area (success and error banners).

## A01 Overview (dashboard)

- **Route** `/dashboard`. **Status** BUILT. **All roles.** Two columns at 880 px and up (65 / 35); stacked below.
- **Purpose:** show where you stand and the one thing to do next.
- **Left column:**
  1. Headline "Latest audit" with the score numeral and the date.
  2. **Your next step** card, exactly one action, chosen in this order: no audits -> `Run your first audit`; structured data failing and WordPress not connected -> `Connect WordPress (+20 points)`; failing and connected -> `Apply your first fix (+20 points)`; another check failing -> `Fix: <plain title> (+N points)`; all passing -> `Re-check your site`.
  3. A "What changed" line: "Up 10 points since 19 Sep" / "Same score as 19 Sep" / with one audit: "Run another audit after your fixes to see your progress here."
  4. List "What to fix" (or "Your biggest wins" when more than three need attention), as insight cards.
- **Right column:** "Recent scores" (small history rows with the score in the display type) and an **Ad Grants** block.
- **Ad Grants block:** not confirmed -> "Available once your FCRA registration has been confirmed by SEctOr." (exists), with no teaser. Confirmed and Pro -> status and open alerts count.
- **States:** no audits yet ("Scores appear here after your first audit."); WordPress not connected ("Connect WordPress for supported improvements. Once connected, SEctOr adds the missing organization details to your site for you and re-checks it."); all passing; loading; error.

## A02 Audits

- **Route** `/audits`. **Status** BUILT. **Heading** "Audits" with "Run an audit, see what needs attention, and fix it." (exists)
- **Today it is one long page with these sections** (exists): Run an audit, Results, History, WordPress connection, Review this website change, Website change history, Full report.
- **Redesign (PROPOSED):** make it a page with tabs: `Results`, `WordPress`, `Full report`, `History`. The journey strip appears while WordPress is not connected.
- **Website setting:** the audited website is shown and changeable here. Saved message (exists): "Website saved. Audits and full reports now check this address." Changing it requires verifying again before the next full report (exists): "Changing your website means verifying it again before the next full report."
- **Run an audit:** `Run audit` button; a running state; results replace the previous result at the top of the tab.
- **History:** rows with date, score (display type) and a link to that result.

## A03 Audit results and insight cards

- **Part of** `/audits`. **Status** BUILT. Same card anatomy and the seven checks as `P01`, plus: the card for structured data shows `Review the change` when WordPress is connected, or "Connect WordPress below to apply this fix directly, or <see the manual steps>" (exists) when not.
- **Other findings** open **manual fix steps** in plain words (only structured data has a live fix).
- **States:** results; all passing; none yet; audit failed to run (plain reason).

## A04 WordPress connection

- **Part of** `/audits`. **Status** BUILT. **Owner and staff** can connect; viewer reads.
- **Fields:** Site address (must start with `https://`); WordPress username; Application password. A help drawer explains how to create an application password (PROPOSED).
- **Security note:** "Your application password is stored encrypted and never shown again." (PROPOSED wording; the behavior is true.)
- **States:**
  - Not connected (exists): "Not connected. Connecting lets SEctOr apply structured-data fixes to your site and re-check them."
  - Connected (exists): "WordPress is connected. Structured-data fixes can now be applied directly." Show site address and `Disconnect` (PROPOSED).
  - Errors, each with its own message: address is not https (tell them to turn on https with their web host, then connect again); the site redirects (name the address to use); wrong username or password; the SEctOr companion plugin is not installed; the address cannot be reached.
- **Action:** `Connect WordPress`.

## A05 Review a website change

- **Part of** `/audits`. **Status** BUILT. **Owner and staff.**
- **Purpose:** the user sees exactly what will change before anything is written to their site.
- **Regions:** target site address; the organization details to be added; **old value and new value** side by side; a warning to check for existing structured data from SEO plugins (exists): "The previous plugin value is recorded for restoration. Check for existing schema from SEO plugins before approving."
- **Actions:** `Approve and apply` (primary), `Cancel`. The button text says exactly what happens.
- **States:** proposal ready; stale (the site changed since the proposal; ask them to review again); applying; outcome (see `A06`); duplicate request (do not apply twice); the organization's website changed (ask to re-verify).

## A06 Website change history

- **Part of** `/audits`. **Status** BUILT.
- **Rows:** date, what changed, before and after score, outcome, and `Restore previous value`.
- **Outcome copy (exists):**
  - Verified: "Change saved and structured data detected on re-check."
  - Unverified: "Change saved; public verification is incomplete. Check your site before applying anything else."
  - Restored: "Previous plugin value restored. Check your public page after refreshing any cache."
  - Empty (exists): "Approved changes and their verification outcomes appear here."
- **Rule:** an unknown outcome is never retried automatically; the user is told to check their site.

## A07 Full report

- **Part of** `/audits` (own tab in the redesign). **Status** BUILT. **Starter and above**; owner and staff create; viewer reads.
- **Purpose:** a deeper check of the whole website, with a PDF to share.
- **States, in order:**
  1. **Locked** (Free): the locked frame (`A15`) with a muted example of a report.
  2. **No website:** "Add your website above first. The full report checks your own website only." (exists)
  3. **Verify ownership:** "We only create full reports for websites their owners have verified. Use any one of these, then press Check." Three ways: connect WordPress (automatic), add a line to the homepage (`Copy line`), or add a DNS record (type, name, value; "DNS changes can take up to an hour"). A `Check` button. Success: "Your website is verified through <method>. You can now create full reports."
  4. **Ready:** `Create your first full report` (or `Create a new report`), with "Takes about 2 to 4 minutes. Up to 10 a day." (exists)
  5. **Running:** "Your report is about to start" then "We are reading up to 20 pages, testing speed on a phone, checking accessibility and how your links look when shared." (exists) Calm progress, no countdown. The user can leave and come back.
  6. **Done:** a summary and overall score; area scores; **action plan in three groups: Do first, This month, Later**; page count checked; a clear list of "What we could not check" (never shown as a result); `Download PDF`; previous reports list.
  7. **Failed** (exists): "The last report could not finish" with a reason in plain words and `Try again`.
- **Report content sections** (same in the PDF): Summary; Search (how easily search engines and AI assistants can find, understand and show each page); Website health (speed, phones, security, broken links); Accessibility (whether people with low vision, or who use a keyboard or screen reader, can use the homepage); Social and sharing (profiles the site points to, and how it looks when shared); Your action plan; What we could not check.
- **PDF:** A4, a header and footer with "SEctOr full report" and page numbers; the on-screen report and the PDF share the same structure.

## A08 Content

- **Route** `/content`. **Status** BUILT. **Starter and above.** Heading "Content" with "Prepare drafts from your program facts, review the claims, and approve before export. Named beneficiaries need active consent on file." (exists)
- **Sections** (exists): Drafts; Write a new draft; Consent on file; Brand voice. In the redesign these may be tabs: `Drafts`, `Consent`, `Brand voice`.
- **Drafts list:** each draft shows title, kind (Case study, Social post, Quote), a status (**Draft, waiting for approval** / **Approved** / **Exported**), the draft text, the source facts, and actions `Edit draft`, `Add to calendar`, `Approve draft`, then `Download` once approved.
- **Allowance meter** (PROPOSED): "9 of 15 pieces used this month".
- **Empty** (exists): "No drafts yet." with `Write your first draft`.
- **Messages (exist):** "Draft created. Review it below before approving."; consent block: "Export stopped: there is no active consent on file for <names>. Record their consent below, then export again."; generation off: "Draft generation is not switched on for SEctOr yet. Everything else on this page works."
- **Rules:** approval is a separate, deliberate step; editing an approved draft returns it to draft; downloading again never uses another piece.

## A09 Draft editor (new draft and edit)

- **Part of** `/content`. **Status** BUILT.
- **Fields** (exist): a checkbox `Write or paste a draft without AI`; Type (Case study, Social post, Quote); Topic or title; Facts ("One per line, with source and reporting period. Check generated claims before approval."); Draft text (when writing manually); People featured ("Full names, separated by commas. Leave blank if no one is named.").
- **Actions:** `Save draft` (manual) or `Write draft` (AI, when on).
- **Rules:** for a case study or quote, the user must list people or state that no one is identified. A person named only in the free-text facts is not caught by the system, so the approval step carries that risk; say "Check that every person named in the text is listed above" near the approve button.
- **States:** new; editing (shows the revision); saved; changed elsewhere ("This draft changed in another session. Reload it before saving again."); allowance reached ("Your plan includes 15 generated pieces of content a month and you have used them. The allowance resets at the start of next month; contact SEctOr if you need more.").

## A10 Consent records

- **Part of** `/content`. **Status** BUILT. **Owner and staff** record; all read.
- **Fields** (exist): Person's full name; They agreed to (Story, Quote, Photo, Everything); How consent was given (hint: "For example: signed release form, 12 March 2026.").
- **List:** name, scope, how given, date, status (Active or Revoked), `Revoke`.
- **Empty** (exists): "No consent recorded yet."
- **Rule:** revoking consent blocks later export of anything that features the person, even if it was already approved.

## A11 Brand voice

- **Part of** `/content`. **Status** BUILT. One field "How your organization sounds" ("A few sentences. Drafts follow this tone.") and `Save brand voice`. Colour and logo tokens are not stored today (the data model has a place for them); a richer brand kit is PROPOSED and optional.

## A12 Content calendar

- **Route** `/calendar`. **Status** BUILT. **Starter and above.** Heading "Content calendar": "Plan your NGO's communications, assign responsibility, and post approved content manually. Dates use Asia/Kolkata." (exists)
- **Regions:** month picker; "Your plan" list for the month; the suggested plan (`A13`); "Plan a post" form.
- **Plan item shows:** date and channel, the draft's title, the objective, the responsible person, a status: **Draft, needs approval** / **Ready to post manually** / **Blocked: consent required**, and `Open content to review or download`, `Edit plan`, `Remove`.
- **Form** (exists): Content draft; Posting date; Channel (Facebook, Instagram, Email, Website, LinkedIn); Objective (hint: "For example: explain a program result or invite volunteer applications."); Responsible person. Needs an existing draft; with none, the form is replaced by "Create your first draft before planning a post. Manual drafts work without AI."
- **Message** (exists): "Calendar saved. Nothing has been scheduled or published."
- **Optional layouts to explore:** a month grid or week view that still shows the same items. Keep the list view for narrow screens.

## A13 Suggested plan

- **Part of** `/calendar`. **Status** IN REVIEW (open pull request).
- **Purpose:** start from a plan, not a blank page. Never claims to write the posts.
- **Copy:** "A starting point, not finished posts: each slot says what kind of post to write and what real facts to bring. Nothing here is saved, scheduled or published until you plan a post. Each draft you write uses one of your monthly pieces."
- **Controls:** `Next four weeks`, `Three months`. The three-month button is disabled until the organization has exported 8 pieces, with "Three months opens after you export 8 pieces of content. You have exported 3."
- **Content:** slots grouped in four-week blocks (the first open, the others collapsed): "Weeks 1 to 4", "Weeks 5 to 8", "Weeks 9 to 12". Each slot: objective ("Share an impact story"), the day and channel ("Mon, 2 Nov, Facebook"), a hint about which real facts to bring, and `Plan this`. A slot already planned shows **Planned**.
- **The five objectives rotate:** share an impact story; thank supporters or volunteers; invite people to volunteer or donate; announce an event or an update; explain your cause in plain language.
- **Flow:** `Plan this` fills the calendar form; with no drafts, it opens the draft form with the slot's objective and returns with the slot kept.

## A14 Ad Grants

- **Route** `/ad-grants`. **Status** BUILT (live data waits for Google approval). **Pro**, and only after SEctOr confirms FCRA. Owner links the account; others read.
- **Not confirmed (exists):** "Google Ad Grants tools open once SEctOr has confirmed your organization's FCRA registration." with "Google only grants free ad budget to organizations that meet its nonprofit requirements, so this check comes first. SEctOr confirms it by checking your FCRA certificate." No teaser of benefit.
- **Confirmed, not linked:** "Link your Google Ads account": field `Google Ads customer ID` (hint "Ten digits, shown at the top of your Google Ads account, for example 123-456-7890."), `Link account`.
- **Linked:** "Compliance" section: the checks run against Google's published rules, each with a pass or needs-attention mark, a plain explanation, and the open alerts. Statement (exists): "SEctOr checks your Ad Grants account against the rules Google enforces and flags anything that needs attention. It reads your account only and never changes your campaigns."
- **States:** live data not available yet (say so plainly); no alerts ("Nothing needs attention"); alerts present; loading; error.

## A15 Locked feature

- **Used by** any gated screen. **Status** BUILT. Full pattern in `02-pricing-and-plans.md` section 3.2.
- **Frame:** feature name; one sentence on what it does; the plan line ("The full report is part of the Starter plan."); one action ("Contact SEctOr to upgrade" or "Join the founding-member waitlist"); a muted example marked "Example".
- **Tone:** informative, never an error.

## A16 Organization profile and website

- **Route** `/account`. **Status** PROPOSED. **Owner** edits; others read.
- **Purpose:** one place for who the organization is. Today the website is set on `A02` and nothing else is editable after signup.
- **Fields:** organization name; type; website; PAN; "FCRA registered" (a self-declaration); FCRA registration number; 12A number; 80G number. A **FCRA status line**: "You declared FCRA registration. SEctOr has not confirmed it yet." or "Confirmed by SEctOr on <date>."
- **Rules:** never show a verified mark for self-declared data; the confirmation is shown only when SEctOr's team has done it.

## A17 My plan

- **Route** `/plan`. **Status** PROPOSED. Full spec in `02-pricing-and-plans.md` section 5.

## A18 Website research: four tabs

- **Route** `/research`. **Status** IN REVIEW (the checks engine is in a pull request) for the engine; **the screens are PROPOSED**. The plan that includes it is undecided.
- **Purpose:** a report an organization can work through one area at a time, specific to its own website.
- **Before it exists:** `Request a website research report` for the organization's own verified website; a note that it can take a while.
- **Statuses:** queued, running, **in review** (SEctOr's owner reviews every report before release), **released**, failed. Before release the organization sees only "Your audit is being reviewed" and no scores.
- **After release:**
  1. Header: the website, date, **overall score**, and the platform detected (WordPress, Wix, Squarespace, Webflow, Shopify, custom, unknown) as a hint, not a gate.
  2. Four **tabs / pillar cards**, each with its score: `SEO`, `AI visibility (GEO)`, `UI/UX`, `Content and brand`.
  3. Inside each tab: **score** with a short reading of what it means; **What is working**; **What to fix first** (ranked by points gained against effort); **Findings**, each with a plain statement, the **evidence quoted from the organization's own pages or supplied data**, and its source; a **Could not check** list; for Content and brand also a **brand direction summary**.
  4. A **method note:** which layers were used (automated checks and AI analysis in v1; reference organizations and peers later) and what was not included.
  5. `Download PDF` (later).
- **Social input (PROPOSED):** a small form to add up to a few public post links and to upload exports or screenshots of the organization's own accounts. State plainly what was and was not read. There is **no scraping of social platforms**.
- **Honesty rules to draw into the UI:** a check that could not run is shown as "could not check" and never scored; every finding shows its evidence; no invented benchmarks.
- **States:** not requested; queued; running; in review; released; failed; plan-locked; viewer read-only.

## A19 Researcher: grants and tenders

- **Route** `/researcher`. **Status** COMING SOON. Draw only the locked "coming soon" frame, plus an optional concept screen clearly labelled "Concept, not built".
- **Concept:** a watchlist of funding opportunities, tenders, events and accelerators relevant to the organization; each match shows relevance, deadline, source link and `Start a draft application` (which opens content). Sources are a maintained watchlist, not a live search of one database.

## A20 Automatic posting

- **Route** `/social`. **Status** COMING SOON. Locked "coming soon" frame only. State that automatic posting to Facebook and Instagram will start only when SEctOr's platform approval clears, with no dates, and that LinkedIn follows its own approval. The calendar remains manual until then.

---

# GROUP I: internal (SEctOr ops only)

## I01 Ops console

- **Status** PROPOSED. Today all of this is done by command-line scripts. Lowest priority; design only after the app.
- **Areas:** organizations list (plan, type, website, FCRA self-declared and confirmed); set plan after invoicing (free, starter, growth, pro); confirm FCRA; issue password-reset links; **research audit review** (see all findings grouped by pillar and layer, edit or delete findings, override a score with a required one-line reason, then `Release to organization`); pilot numbers (audited, connected WordPress, fixes verified, average score change, plans).
- **Rules:** every action is logged; the original machine output is never overwritten by a review edit; actions are limited to the SEctOr owner account.

---

# Cross-screen patterns to design once and reuse

- **Message banners:** success, information, needs-attention. Never red for ordinary problems (red is reserved for destructive or failed-payment states, which do not exist in v1).
- **Loading:** skeletons for lists; for long jobs (reports, research) a calm status with what is happening and how long it usually takes.
- **Empty states:** every list has one, with one action.
- **Read-only (viewer):** controls hidden or disabled with a one-line reason ("Only owners and staff can do this").
- **Confirmation before anything is written to the organization's website.** The button says exactly what happens.

---
name: SEctOr
description: Paper, ink and one quiet pine. A careful colleague's working tool for NGO visibility.
colors:
  paper: "#f6f7f3"
  ink: "#161b17"
  ink-muted: "#5b6058"
  line: "#e2e4dc"
  pine: "#1f4d3b"
  ochre: "#9c6b1f"
  on-pine: "#f6f7f3"
  paper-dark: "#161b17"
  ink-dark: "#f6f7f3"
  ink-muted-dark: "#a9ada4"
  line-dark: "#2e352f"
  pine-dark: "#4a8a6f"
  ochre-dark: "#c99445"
  on-pine-dark: "#161b17"
typography:
  score:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "72px"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "\"tnum\", \"lnum\""
  headline:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "32px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  row-score:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.6
  title:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
  wordmark:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.6
  body:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "\"tnum\""
  body-strong:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.6
  small:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  focus: "2px"
  md: "6px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "64px"
components:
  button-primary:
    backgroundColor: "{colors.pine}"
    textColor: "{colors.on-pine}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-primary-dark:
    backgroundColor: "{colors.paper-dark}"
    textColor: "{colors.ink-dark}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-quiet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-link:
    textColor: "{colors.pine}"
    typography: "{typography.body-strong}"
    padding: "0"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "44px"
  nav-link:
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    padding: "4px 0"
  nav-link-active:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "4px 0"
  mark:
    size: "18px"
---

# Design System: SEctOr

Origin: the binding visual system is `docs/design/design-system.pdf` (approved by the user, followed exactly, confirmed 2026-10-03). This file records how that system shipped in `apps/web/src` (tokens and component rules in `src/app/globals.css`, components in `src/lib/ui.tsx`), including the places where the build adapted or extended the PDF. Where this file and the PDF disagree, the divergence is named below and was deliberate; anything not named here defers to the PDF.

## Overview

**Creative North Star: "The Careful Colleague"**

SEctOr looks like a careful institution's working paper rather than a vendor's pitch. It uses a paper-and-ink base, one living colour (pine), and an editorial serif kept for the one number that matters. Everything is left-aligned and sits directly on paper. Structure comes from hairlines, not boxes, and depth comes from the order of the content, not from shadows. Density is moderate: generous vertical rhythm between findings and rows, with a 70ch measure on prose.

The score appearing is the hero. A 72px Newsreader numeral counts up from zero over about 600ms with ease-out, and a 2px rule beneath it draws in sync. That is the product's only orchestrated motion. Everything else is instant or a 150ms opacity or colour change. A failing check reads as guidance: ochre marks, the plain words "Needs attention", and an inline fix. It never uses red, alarm language or a badge.

The PDF rejects, on the user's authority: the warm-cream-and-terracotta AI look, glossy SaaS gradients, urgency timers, stock photography, dark-mode-with-neon hacker aesthetics, centred hero cards, card grids, and anything that reads as selling rather than explaining.

**Key Characteristics:**
- Paper ground, ink text, hairline structure; no card chrome, no shadows.
- One accent (pine), spent only on primary actions/links and "passed".
- Ochre means "needs attention". True red is reserved and unused.
- Newsreader announces (score, page headlines, history-row scores); Public Sans explains (everything else, including the wordmark).
- One 6px radius; one 4-to-64px spacing scale.
- Pass/fail is always a drawn mark plus a word, never colour alone.

## Colors

The palette is a cool sage-tinted paper and green-black ink with a single deep botanical accent. Colour is rare enough to mean something when it appears.

### Primary
- **Pine** (light `pine`, dark `pine-dark`): primary buttons, links, the focus ring, the active-nav underline, the input caret and checkbox accent, text selection, and the drawn pass mark. It is deep and desaturated, not Kelly green, and never a gradient.

### Secondary
- **Ochre** (light `ochre`, dark `ochre-dark`): "needs attention". It colours the drawn attention mark only (see The Ink Words Rule). It is deliberately not red.

### Neutral
- **Paper** (`paper`): the page ground everywhere, a whisper of sage rather than cream. `on-pine` is the same value, used for text on filled pine.
- **Ink** (`ink`): primary text, headlines, the score numeral, the score rule, and status words.
- **Ink Muted** (`ink-muted`): secondary text, captions, timestamps, hints, placeholders, and inactive nav. It measures about 6:1 on paper.
- **Hairline** (`line`): borders, dividers, input outlines, row separators, and the single rule under the nav.

### Dark mode
Dark mode is secondary to the design and follows `prefers-color-scheme`. It inverts the base: `paper-dark` is the ground and `ink-dark` the text. Pine and ochre are lightened as the PDF specifies. **Build extension:** `ink-muted-dark` and `line-dark` are not in the PDF. They were added to complete the inversion and are now part of the system.

### Reserved
The PDF reserves true red (#B3261E) for real destructive or error states, such as a failed payment or a confirmed delete. No v1 surface uses it, so it is not a token. Error messages use the ochre attention mark.

### Named Rules
**The Two Jobs Rule.** Pine is spent on exactly two things: primary actions/links and "this passed". A third use case gets ink or ink-muted, never a second accent.

**The Ink Words Rule.** Spec ochre on paper (4.30:1) and spec dark pine on ink (4.29:1) fall below AA for small text, so the hex values stay as specified but they are never used as small-text colour. Status words ("Passed", "Needs attention") are set in ink. The colour lives on the drawn SVG mark beside them, a non-text graphic that needs only 3:1.

**The Paper-Text Dark Rule.** In dark mode, links and buttons set their text in paper (`ink-dark`) and carry pine only as decoration. Links get a pine underline. Buttons become transparent with a 2px pine border, replacing the light-mode pine fill. Quiet buttons keep their 1px hairline.

**The Undecided Rule Colour.** The score rule is always ink as shipped. The PDF suggests pine "when the score is good", but whether the rule turns pine above a "good" threshold, and what that threshold is, remains an **open human decision**. Until someone decides, keep it ink. Do not invent a threshold.

## Typography

**Display Font:** Newsreader (with Georgia, serif), weights 400 and 500, self-hosted via next/font.
**Body Font:** Public Sans (with system-ui, sans-serif), weights 400 and 600.

**Character:** Two families with a clear division of labour. Newsreader announces, Public Sans explains. The scale steps by a modest 1.25 ratio from a 16px base, because this is a working tool, not a magazine.

### Hierarchy
- **Score** (Newsreader 400, 72px, line-height 1, tabular lining figures): the audit score numeral only. It is not bold; size carries it.
- **Headline** (Newsreader 500, 32px, 1.2, -0.01em, balanced wrap): one page headline per screen.
- **Row score** (Newsreader 400, 20px): score figures in history rows. This is a small extension of "the score numeral" to the same number shown in a list.
- **Title** (Public Sans 600, 20px, 1.3, balanced wrap): section headings.
- **Wordmark** (Public Sans 600, 20px): "SEctOr", written exactly so. It is a text wordmark in the sans, not the serif.
- **Body** (Public Sans 400, 16px, 1.6, tabular figures): everything else, capped at 70ch for prose. Labels, finding titles and button text use the 600 weight.
- **Small** (Public Sans 400, 13px, 1.5, ink-muted): captions, timestamps, hints, and the render caveat. The exception is finding status words at 13px, which are set in ink.

### Named Rules
**The Announce/Explain Rule.** Newsreader appears only on the score numeral, page headlines, and score figures in history rows. The wordmark, section headings, buttons, labels and body are Public Sans.

**The Sentence Case Rule.** No all-caps labels and no tracked uppercase anywhere. De-emphasise with ink-muted and size, not case.

## Layout

- **Alignment and container:** everything is left-aligned. Signed-in pages and the shell bar share a 1040px container. The free audit, login and signup use a 560px narrow column.
- **Page padding:** 48/24/64px (top/sides/bottom). Below 480px it tightens to 32/16/48px.
- **Signed-in shell:** wordmark, organisation name, and the user's name and role on one baseline row. Below it sits a plain text nav (Overview, Audits, Ad Grants, Content) with one hairline underneath. There is no sidebar, icon rail or collapsed menu. Below 480px the user block wraps to its own full-width line.
- **Overview:** two columns at 880px and up, split 65/35 with a 48px gap. Primary content goes on the left and contextual material (recent scores, compliance alerts) on the right. Below 880px they stack.
- **Sections:** separated by a hairline, with 32px above and 32px below the rule. The first section has no rule.
- **Vertical rhythm:** findings are spaced 24px apart. Rows have 12px vertical padding with hairlines between them. Drafts get 24px padding.

**The Scale-Only Rule.** Every margin, padding and gap comes from 4/8/12/16/24/32/48/64px (`--s-1` to `--s-8`). There are no arbitrary 13px or 22px offsets.

## Elevation & Depth

The system is flat. There are no shadows anywhere, by default or on hover. Separation comes from hairlines, whitespace and type weight. If a floating element ever needs separation, a single hairline border is the first answer.

**The Hairline-Before-Shadow Rule.** A one-pixel `line` border does the job before any shadow is considered. There are no drop-shadows under cards, because there are no cards.

## Shapes

One radius, 6px, is used on buttons, inputs and the rare contained surface. It is not 0 (too severe) and not 16px or more (too consumer). The focus ring uses a 2px radius. Borders are always 1px hairlines, except the dark-mode primary button border (2px pine) and the score rule (2px ink). The drawn marks are 18px SVGs with a single 1.75px stroke and round caps.

## Components

### Buttons
Plain and declarative, labelled with exactly what happens ("Run free audit", "Apply fix to my WordPress site").
- **Shape:** 6px radius, 44px minimum height, 8px 16px padding, Public Sans 600.
- **Primary:** pine fill, paper text, 1px pine border. On hover, opacity drops to 0.9 over 150ms. Disabled is 0.55 opacity. There is no lift or shadow.
- **Primary, dark mode:** transparent with a 2px pine border and paper text (The Paper-Text Dark Rule).
- **Quiet:** transparent with ink text and a 1px hairline border. On hover the border shifts to ink-muted.
- **Link button:** no box. Pine text with a 1px underline at a 3px offset, thickening to 2px on hover. In dark mode the text is paper and the underline pine.
- **Focus:** a 2px pine outline at a 2px offset on every interactive element.

### Links
Pine, underlined 1px at a 3px offset, thickening to 2px on hover over 150ms. In dark mode the text is paper with a pine underline.

### Inputs / Fields
- **Style:** transparent background, 1px hairline, 6px radius, 44px minimum height, 8px 12px padding, pine caret. The label is Public Sans 600 above the field, with an optional 13px ink-muted hint between label and field. Textareas are at least 96px and resize vertically.
- **Hover / Focus:** hover shifts the border to ink-muted. Focus turns the border pine and adds the pine focus ring with no offset.
- **Checkbox:** 18px native control with a pine accent and a 12px gap to its label.
- **Inline form:** the field grows from 240px with the button beside it, and wraps on narrow screens.

### Navigation
Text links in ink-muted with no underline. Hover turns them ink. The current page is ink with a 2px pine underline at a 10px offset, sitting near the nav hairline. Items have a 24px horizontal gap and wrap on small screens.

### Score (signature component)
The Newsreader numeral, then a 2px full-width ink rule (12px above, 8px below), then "out of 100" in ink-muted, in a block at most 240px wide. It sits directly on paper and is never in a card. On a new result the numeral counts from 0 with a cubic ease-out over 600ms, and the rule scales from the left in sync. With reduced motion, or on the overview where `animate` is false, the final value shows instantly. A raw-HTML render caveat in small text always follows a shown score.

### Findings list (signature component)
A plain list with no bullets and 24px between items. Each item is a drawn mark, then a body: the title in Public Sans 600, the status word in 13px ink, and the detail in ink-muted. Failing items sort first, and each carries its own fix action inline (12px above it). Manual fix steps are an indented ordered list.

### Marks
Drawn SVG, 18px, one 1.75px stroke weight: a check for pass in pine, and a cross for needs attention in ochre. They are `aria-hidden` and always paired with a word. Notices (form and API messages) reuse the same mark beside plain text.

### Rows
Used for history, consents and alerts. Each is a flex row with the main text left and a value right (scores in 20px Newsreader), 12px vertical padding, and hairlines between rows. Long URLs wrap anywhere rather than overflow.

## Do's and Don'ts

### Do:
- **Do** place the score directly on paper, left-aligned, with an ink rule and "out of 100" beneath it.
- **Do** pair every pass/fail with a drawn SVG mark and the words "Passed" or "Needs attention" in ink.
- **Do** keep pine to primary actions/links, the pass mark, focus, active-nav and selection states.
- **Do** take every margin, padding and gap from the 4/8/12/16/24/32/48/64px scale.
- **Do** use a single 6px radius and 1px hairlines for all structure.
- **Do** keep hover and focus changes to 150ms opacity/colour/underline-thickness, and honour `prefers-reduced-motion` everywhere, including the count-up.
- **Do** keep the score rule ink until a human decides on a "good" threshold.

### Don't:
- **Don't** set small text in ochre on paper or in dark pine on ink. Both are below AA at 13 to 16px.
- **Don't** use glyph or font icons (✓ ✗ ⚠) for pass/fail. Marks are drawn SVG in one stroke weight.
- **Don't** use Newsreader for the wordmark, section headings, buttons or body.
- **Don't** introduce shadows, gradients, card grids, centred hero cards, or a second accent colour.
- **Don't** use red for failing checks or form errors. True red (#B3261E) is reserved for real destructive states.
- **Don't** use all-caps or tracked-uppercase labels.
- **Don't** animate anything other than the score count-up and its rule.

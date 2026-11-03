# SEctOr design brief

Complete documentation for a new UI/UX design of the SEctOr web app, written to be pasted into Figma and used
to generate wireframes. Written 2026-11-03 against `main` at `cd9679c`, plus two open pull requests.

| File | What it is | Use it for |
|---|---|---|
| [01-product-users-flows.md](01-product-users-flows.md) | The product, users and roles, sitemap, navigation, eleven flows, constraints, open decisions | Understanding the product; the flow prototypes |
| [02-pricing-and-plans.md](02-pricing-and-plans.md) | The Free, Starter, Growth and Pro plans, the feature matrix, locked and coming-soon rules, the pricing page | The pricing page and every locked state |
| [03-screen-specs.md](03-screen-specs.md) | 29 screens, each self-contained with regions, data, states and copy | Wireframes, one screen at a time |
| [04-components-content-accessibility.md](04-components-content-accessibility.md) | Design guardrails, the current visual system as a reference, components, status vocabulary, voice, accessibility, Figma setup, a wireframe prompt template | The component library and the rules |
| [screens.csv](screens.csv) | One row per screen: id, route, status, plans, roles, states | Importing the screen list |

## Status labels

`BUILT` works today. `IN REVIEW` is in an open pull request. `SPECIFIED` has a written spec only. `PROPOSED` is
new in this brief and needs a founder decision. `COMING SOON` is not built and must never be drawn as working.

## Read this first

- **Plans:** three paid plans (Starter, Growth, Pro) plus Free. Prices are Rs, **plus 18% GST**. Payment is by manual invoice: there is no checkout. Growth and Pro are a founding-member waitlist, and today they add almost nothing live beyond Starter. The pricing page has to say that honestly.
- **Never imply** that SEctOr verified an organization's FCRA, PAN, 12A or 80G, show customers or numbers that do not exist, or show anything as scheduled or published.
- **Open decisions** are listed at the end of parts 1 and 2. The biggest: whether to replace the current visual system (recorded as binding on 2026-10-03), the language or languages, and how plan requests reach SEctOr.

## Sources of truth

If this brief and these differ, they win: `docs/product/product.md` (pricing and plans), `packages/shared/src/plans.ts`
(what the app enforces), `apps/web/PRODUCT.md` and `apps/web/DESIGN.md` (current product and visual system),
`docs/plans/` (specs for the calendar planner and the research report), `CLAUDE.md` (rules for engineering).

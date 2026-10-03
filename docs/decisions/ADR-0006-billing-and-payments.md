# ADR-0006: Billing / payments provider for paid subscriptions

## Status
PROPOSED — HUMAN DECISION REQUIRED. Per CLAUDE.md §7 ("a new external
service... seems necessary" is a stop condition) and §2 ("do not introduce
a new service... without an ADR"), no billing code should be written
against a real charge path until this is CONFIRMED. `docs/product/product.md`
currently lists a billing system as a Phase 0-1 **non-goal** — this ADR is
what turns "charge 5 real NGOs" from a non-goal into a scoped decision, not
an assumption to build against quietly.

## Context
Nothing in this repo — not `PROJECT.md`, not `docs/product/product.md`, not
`.env.example`, not `docs/integrations/integrations.md` — names a payment
provider, a pricing model, or even a currency. There is no `Subscription`,
`Invoice`, or `Plan` concept in the conceptual data model
(`docs/architecture/architecture.md` §11). Before any of Slice 2's
`Organization` table work assumes a `plan` or `status` column shape, this
needs to be decided, because retrofitting a billing relationship onto an
existing tenant schema is more disruptive than deciding it up front.

Constraints specific to this product:
- Client is an Indian registered NGO/society/Section-8 company, not an
  individual — recurring **business** billing with GST-compliant invoicing,
  not a consumer checkout.
- Cross-border card billing is plausible for the India-first cohort but not
  guaranteed; the gateway needs to work for INR-denominated domestic cards
  and net-banking/UPI, which rules out a card-only US-centric checkout as
  the *only* rail.
- Hosting budget is already tight (`PROJECT.md` §5) — a gateway that needs
  its own compute (e.g., self-hosted webhook queue infra) competes for the
  same 16 GB box unless it's kept lightweight.
- FCRA/DPDP context means any payment data (even just "who paid what") is
  organization financial data, not incidental — same tenant-isolation rule
  as everything else (`CLAUDE.md` §3) applies to `Invoice`/`Subscription`
  rows.

## Decision (proposed default)
**Razorpay**, using Razorpay Subscriptions (recurring billing) + webhooks,
as the payment provider for Phase 0-1 MRR.

Reasoning: it's the default choice for an India-first B2B SaaS charging
Indian organizations — native UPI/net-banking/card support, GST invoice
generation built in, INR-native (no forex/settlement friction), and a
webhook model that fits the existing `services/workers` BullMQ pattern
already scaffolded (a `payment.captured` webhook enqueues a job the same
way a crawl request would, rather than needing new infrastructure).

Proposed shape (subject to the feature spec, not committed here):
- One `Plan` per skill-bundle tier (exact tiers/pricing: **UNKNOWN — product
  decision, not proposed here**).
- `Subscription` row per `Organization`, Razorpay `subscription_id` as the
  external reference, status mirrors Razorpay's own subscription lifecycle
  rather than inventing a parallel state machine.
- Webhook endpoint on `apps/api`, signature-verified, idempotent per
  CLAUDE.md §4 (a duplicated webhook delivery must not double-process).
- No card data ever touches SEctOr's own servers — Razorpay Checkout handles
  PCI scope entirely; this repo never sees a raw card number.

## Alternatives
- **Stripe**: better developer experience and docs, but UPI/net-banking
  support for India is weaker than a India-native gateway, and Indian
  business KYC/settlement through Stripe has historically been slower and
  more restrictive than Razorpay/Cashfree for a new Indian entity. Revisit
  only if SEctOr later needs to bill non-Indian orgs at scale (out of scope
  — India-first is confirmed, see `PROJECT.md` §2 non-goals).
- **Cashfree**: comparable to Razorpay on India-specific rails, plausible
  alternative default — no strong reason to prefer Razorpay over Cashfree
  found in this pass; treat as the fallback if Razorpay's own business KYC
  for SEctOr stalls.
- **Instamojo/PayU**: smaller ecosystem, less mature subscription/webhook
  tooling for recurring B2B billing specifically — not recommended.
- **Manual invoicing (bank transfer / UPI QR, no gateway integration)**:
  genuinely worth naming as the *fastest* path to "real MRR" for a 5-NGO
  pilot specifically — zero new code, zero KYC turnaround, an NGO can pay
  by bank transfer against a manually-sent invoice tomorrow. The tradeoff:
  no self-serve upgrade/downgrade, no automatic dunning, someone
  reconciles payments by hand. **Worth strong consideration as the actual
  Phase 0-1 answer** given the 5-NGO scale — a gateway integration is
  arguably solving a scale problem this pilot doesn't have yet.

## Consequences
If Razorpay (or any gateway) is confirmed: new `KYC` turnaround (days to
weeks, outside engineering's control — see the earlier MRR-timeline
estimate), a new `.env` secret pair (`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`),
a new connector-shaped module (`packages/connectors/razorpay/` or similar,
consistent with CLAUDE.md §4's "one folder per provider" rule even though
this isn't a social/analytics connector), and new `Plan`/`Subscription`
rows joining `Organization`, gated by ADR-0002 the same as everything else
in the data model.

If manual invoicing is confirmed instead for the pilot: this ADR's decision
becomes "defer gateway integration past the 5-NGO pilot," and Slice 2 only
needs a `billingStatus` enum on `Organization` (`trial`/`invoiced`/`paid`/
`overdue`), set by an internal ops action, not a webhook. Far less code,
much faster to a first real rupee — the honest tradeoff being no
self-serve growth path past hand-holding 5 accounts.

**This ADR does not pick between those two paths** — that's the actual
decision needed before Slice 2's schema locks in a shape.

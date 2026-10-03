# SEctOr — AI Architecture Protocol

## Purpose

This is the architecture operating protocol for building SEctOr with Claude and other AI coding agents.

It is persistent project guidance, not a giant prompt to paste into every session.

Use it together with `CLAUDE.md`, product docs, architecture docs, and relevant Skill Files.

---

## 1. Role

Claude acts as an engineering architecture partner and implementation agent.

The human remains responsible for:

- Product decisions
- Business priorities
- Risk tolerance
- Important architecture decisions
- Security-sensitive decisions
- Irreversible actions
- Final approval

Claude should:

- Explore before designing
- Design before implementing
- Reuse existing patterns
- Surface unknowns
- Make assumptions explicit
- Keep architecture simple
- Prefer small vertical slices
- Verify real behavior
- Never silently decide important product or architecture questions

---

## 2. Source-of-Truth Hierarchy

When information conflicts, use this order:

1. Explicit human decision
2. Current product requirements
3. Current architecture decisions / ADRs
4. `CLAUDE.md`
5. This architecture protocol
6. Relevant Skill Files
7. Existing source code and tests
8. General engineering knowledge
9. AI assumptions

Do not invent:

- APIs
- Database fields
- Business rules
- External integration behavior
- Security requirements
- Product requirements

If required information is missing, mark it `UNKNOWN` or `HUMAN DECISION REQUIRED`.

---

## 3. Knowledge Boundaries

SEctOr has different types of knowledge.

### Engineering knowledge

Controls how the system is built.

Examples:

- `CLAUDE.md`
- `docs/architecture.md`
- `docs/conventions.md`
- `docs/security.md`
- ADRs
- Runbooks

### Product knowledge

Controls what the product does.

Examples:

- `docs/product.md`
- Feature specifications
- Acceptance criteria
- Roadmaps

### Domain knowledge

Controls what SEctOr knows about NGOs and digital growth.

Examples:

- SEO Skill File
- GEO/AIO Skill File
- Google Ad Grants Skill File
- Content Skill File
- Social Skill File
- CSR Skill File
- Impact Skill File

A Skill File should describe domain intelligence and decision logic, not replace engineering architecture.

---

## 4. Architecture Principle

Prefer:

- Simple over clever
- Boring over novel
- Existing patterns over new abstractions
- Modular monolith over premature microservices
- Relational database over unnecessary graph infrastructure
- Deterministic rules where rules are known
- AI where reasoning or language generation is useful
- Human approval for high-impact actions
- Observable workflows over hidden automation

The goal is the smallest architecture that can reliably produce the required product behavior.

---

## 5. Scope Before Architecture

Before proposing architecture, define:

### What
What exactly is being built?

### Why
What user or business problem does it solve?

### Who
Which user, organization, or system uses it?

### Inputs
What information enters the workflow?

### Outputs
What should the system produce?

### Boundaries
What is explicitly out of scope?

### Success
How will we know it works?

If these are unclear, do not immediately design the system. Ask for or identify the missing decisions.

---

## 6. Architecture Workflow

Use this sequence for meaningful work:

```text
DEFINE
  ↓
EXPLORE
  ↓
PLAN
  ↓
HUMAN GATE
  ↓
BUILD
  ↓
TEST
  ↓
INDEPENDENT REVIEW
  ↓
FIX
  ↓
VERIFY
  ↓
SHIP
  ↓
LEARN
```

Never skip directly from `IDEA → BUILD` for meaningful features.

---

## 7. Explore Mode

During exploration:

- Do not modify code
- Read only relevant files
- Trace the existing workflow
- Identify entry points
- Identify authentication
- Identify authorization
- Identify business logic
- Identify database models
- Identify external integrations
- Identify error handling
- Identify tests
- Identify existing reusable utilities

Return:

- Current behavior
- Relevant files
- Existing patterns
- Constraints
- Risks
- Unknowns
- Reusable components

Understand the actual system rather than designing an imaginary system.

---

## 8. Architecture Decision Rule

For every important architectural decision, explicitly identify:

1. Decision
2. Reason
3. Alternatives
4. Tradeoffs
5. Consequences
6. Status

Use:

- `CONFIRMED`
- `PROPOSED`
- `UNKNOWN`
- `HUMAN DECISION REQUIRED`

Example:

```text
Decision:
Store organization KPIs in PostgreSQL.

Status:
PROPOSED

Reason:
The data is structured, relational, and needs filtering,
aggregation, permissions, and historical reporting.

Alternative:
Document/JSON storage.

Tradeoff:
JSON is flexible but makes reporting and constraints harder.
```

---

## 9. Value-Source Rule

For every important value in a feature, answer:

> Where does this value come from?

Examples:

- Organization name → onboarding input
- Program status → organization staff update
- Website score → crawler + deterministic rules
- Organic traffic → Google Analytics
- Search performance → Search Console
- Ad Grant status → Google Ads / deterministic checks
- AI recommendation → rule engine + relevant Skill File + context

If the source of a value is undefined, the architecture is incomplete.

Mark it `HUMAN DECISION REQUIRED`.

---

## 10. AI Architecture Rule

Do not use an LLM for everything.

Use deterministic code for:

- Validation
- Calculations
- Thresholds
- Permissions
- Authentication
- Authorization
- Status transitions
- Compliance checks where rules are explicit
- Data integrity

Use AI for:

- Explanation
- Classification
- Summarization
- Content generation
- Strategy suggestions
- Natural-language interaction
- Ambiguous reasoning

AI output must not silently become a high-impact system action.

---

## 11. Skill File Rule

Skill Files describe how SEctOr reasons about a domain.

Example structure:

```text
skills/
  seo.md
  geo.md
  aio.md
  ad-grants.md
  content.md
  social.md
  campaigns.md
  brand.md
  csr.md
  impact.md
```

A Skill File can contain:

- Domain concepts
- Rules
- Heuristics
- Checklists
- Decision logic
- Examples
- Recommended workflows
- Failure cases
- Evidence requirements

A Skill File should not contain:

- Secrets
- Production credentials
- Hidden business assumptions
- Unapproved product requirements
- Random architecture decisions

---

## 12. SEctOr Architecture Principle

SEctOr should treat AI capabilities as reusable skills inside one product system.

Avoid building nine isolated agents unless there is a real technical reason.

Think in terms of:

```text
SEctOr Core
│
├── NGO Intelligence
├── Growth Intelligence
├── Funding Intelligence
├── Impact Intelligence
│
├── Search & Growth
│   ├── SEO
│   ├── GEO
│   ├── AIO
│   └── Ad Grants
│
├── Content & Communication
│   ├── Content
│   ├── Email
│   └── Reports
│
├── Distribution
│   └── Social
│
├── Campaigns
│   ├── Meta
│   └── LinkedIn
│
└── Creative & Brand
```

The user experiences one SEctOr system.

---

## 13. Connector Architecture

External integrations should be isolated behind connectors.

Potential connectors:

```text
connectors/
  google-ads/
  google-analytics/
  search-console/
  meta/
  instagram/
  linkedin/
  x/
  youtube/
  whatsapp/
  email/
```

Use common internal interfaces where appropriate:

```text
publish_post()
schedule_post()
get_post_metrics()
get_campaign_metrics()
send_email()
get_search_metrics()
get_analytics()
```

The connector translates internal actions into provider-specific API calls.

This prevents provider-specific logic from spreading throughout the application.

---

## 14. OAuth and Tenant Isolation

Each NGO should authorize its own external accounts.

Conceptually:

```text
SEctOr
   │
   ├── NGO A
   │    ├── LinkedIn connection
   │    ├── Meta connection
   │    └── Google connection
   │
   └── NGO B
        ├── LinkedIn connection
        ├── Meta connection
        └── Google connection
```

Never share one NGO's credentials or tokens with another NGO.

Store tokens securely.

Every external action must know:

- Organization
- Connection
- User
- Permission
- Provider
- Action
- Result

---

## 15. Data Architecture

Prefer PostgreSQL for structured application data.

Typical hierarchy:

```text
Organization
  ├── Users / Staff
  ├── Programs
  │    ├── Goals
  │    ├── KPIs
  │    ├── Targets
  │    ├── Actuals
  │    └── Evidence
  │
  ├── Growth Goals
  ├── Funding Goals
  ├── Integrations
  ├── Audits
  ├── Recommendations
  ├── Actions
  └── Experience Ledger
```

Use JSON only where flexibility is genuinely useful.

Do not introduce a graph database merely because the product contains relationships.

---

## 16. Experience Ledger

SEctOr should eventually preserve:

```text
Problem
→ Recommendation
→ Action
→ Before Metric
→ After Metric
→ Outcome
→ Evidence
→ Confidence
```

This creates a historical learning layer.

The Experience Ledger can later improve:

- Recommendations
- Prioritization
- Content decisions
- Growth strategies
- NGO-specific personalization

Do not build a complicated recommendation engine before the underlying evidence is reliable.

---

## 17. Security Boundary

Security-sensitive functionality requires explicit consideration.

Always inspect:

- Authentication
- Authorization
- Tenant isolation
- Input validation
- Secrets
- OAuth tokens
- Webhooks
- File uploads
- SQL queries
- API permissions
- Rate limits
- Logs
- Personal data
- Data deletion
- External actions

Never commit:

- API keys
- OAuth secrets
- Passwords
- Private credentials
- Production tokens

---

## 18. External Integration Rule

External systems fail.

Design for:

- Timeouts
- Retries
- Rate limits
- Expired credentials
- Partial failures
- Duplicate requests
- Provider outages
- Invalid responses
- Permission changes

For important actions:

```text
Request
→ Validate
→ Idempotency check
→ Execute
→ Record result
→ Retry if appropriate
→ Surface failure
```

Never assume an external API always succeeds.

---

## 19. Idempotency

Any operation that can be retried must consider duplicate execution.

Examples:

- Publishing content
- Sending email
- Sending WhatsApp messages
- Creating ad campaigns
- Creating payments
- Processing webhooks
- Running scheduled jobs

Ask:

> If this operation runs twice, what happens?

If the answer is unclear, architecture is incomplete.

---

## 20. Background Jobs

Use background jobs for:

- Crawling
- Large audits
- Content generation
- Scheduled publishing
- Analytics synchronization
- Report generation
- Monitoring
- Follow-ups

Do not block normal user requests with long-running operations.

Track job state:

```text
queued
running
completed
failed
retrying
cancelled
```

---

## 21. Observability

Every important workflow should make failures understandable.

Capture appropriate:

- Structured logs
- Request IDs
- Organization IDs
- Job IDs
- Integration IDs
- Error information
- Timing
- Retry count
- Result status

Avoid logging secrets or unnecessary personal information.

---

## 22. Vertical Slice Principle

Build the smallest complete workflow.

Bad:

```text
Build entire analytics system
```

Better:

```text
Connect Google Search Console
→ fetch one set of metrics
→ store metrics
→ display them
→ handle failure
→ test workflow
```

A vertical slice should travel through the real system.

---

## 23. Feature Specification

Before implementation, produce:

### Feature
What is being built?

### User
Who uses it?

### Problem
What problem does it solve?

### Current State
How does the system behave now?

### Desired State
What should happen after implementation?

### Inputs
What enters the system?

### Data
What data is created or changed?

### APIs
What endpoints or external integrations are required?

### Permissions
Who can perform each action?

### Edge Cases
What can go wrong?

### Security
What risks exist?

### Testing
How will it be tested?

### Rollback
How can the change be safely reversed?

### Definition of Done
What observable conditions mean the feature is complete?

---

## 24. Acceptance Criteria

Acceptance criteria must be observable.

Weak:

```text
The dashboard should be fast.
```

Better:

```text
Given an authenticated organization user,
when they open the dashboard,
then the organization metrics are displayed,
and data from another organization is never returned.
```

Cover:

- Happy path
- Invalid input
- Missing input
- Boundary conditions
- Duplicate requests
- Unauthorized requests
- Dependency failure
- Regression behavior

---

## 25. Implementation Plan

An implementation plan should identify:

- Files to modify
- Files to create
- Data model changes
- API changes
- UI changes
- Integration changes
- Tests
- Migration
- Rollback
- Verification steps

Prefer small sequential steps.

---

## 26. Stop Conditions

Claude should stop and ask for a decision when:

- Database architecture changes significantly
- Authentication design changes
- Tenant isolation is unclear
- External API behavior is unknown
- Security implications are unclear
- Existing code conflicts with the proposed approach
- Tests contradict the plan
- A destructive action is required
- A migration may cause data loss
- A new architectural pattern is required
- Scope expands substantially
- Too many unrelated files are affected
- A product decision is hidden inside an engineering decision

Do not guess through high-risk ambiguity.

---

## 27. Context Management

Do not load the entire repository unnecessarily.

For a task:

```text
CLAUDE.md
+
Relevant product document
+
Relevant architecture document
+
Relevant Skill File
+
Relevant source files
+
Relevant tests
```

Avoid giant context dumps.

Better context produces better reasoning.

---

## 28. Existing Code First

Before creating a new utility, component, service, hook, API pattern, or abstraction:

Search the repository.

Ask:

> Does this already exist?

Prefer:

```text
Reuse
→ Extend
→ Refactor
→ Create new
```

not:

```text
Create new
→ duplicate existing functionality
```

---

## 29. Smallest Useful Change

For every feature, ask:

> What is the smallest change that creates real user value?

Avoid:

- Premature abstractions
- Framework changes without need
- Large refactors
- New infrastructure without need
- New dependencies without reason
- Unrelated cleanup

---

## 30. No Silent Scope Creep

If the task is:

```text
Add SEO audit
```

do not silently add:

- New CMS
- New analytics platform
- Social scheduler
- Billing
- CRM
- Mobile application

Record future ideas separately.

---

## 31. Review

Implementation review is separate from implementation.

Review for:

### Correctness
Does it satisfy the requirement?

### Security
Can users access data or actions they should not?

### Data
Can incorrect or duplicated data be created?

### Concurrency
Can race conditions occur?

### Validation
Are invalid inputs handled?

### Errors
Are failures handled clearly?

### Integrations
Are provider failures handled?

### Backward Compatibility
Could existing workflows break?

### Tests
Do tests prove behavior?

### Complexity
Is the solution unnecessarily complicated?

### Scope
Did implementation exceed the approved task?

---

## 32. Verification

Never equate:

```text
Tests pass
```

with:

```text
Feature works
```

Verification should include:

1. Acceptance criteria
2. Unit/integration tests
3. Type checking
4. Linting
5. Error inspection
6. Security checks
7. Regression checks
8. Real application behavior
9. User workflow verification

Report status as:

```text
PASS
FAIL
UNVERIFIED
```

Never claim verification that was not actually performed.

---

## 33. Evidence Ladder

Use evidence in this order:

```text
Actual production/user behavior
        ↓
Real application workflow
        ↓
Integration test
        ↓
Unit test
        ↓
Static/type/lint checks
        ↓
Reasoning
        ↓
Assumption
```

The higher the evidence, the stronger the confidence.

---

## 34. Architecture Documentation

Maintain a small project knowledge layer:

```text
docs/
  product.md
  architecture.md
  conventions.md
  security.md
  decisions/
  plans/
  runbooks/
```

Keep documents current.

Do not create documentation that no one will maintain.

---

## 35. ADR Rule

Create an Architecture Decision Record when a decision:

- Has meaningful tradeoffs
- Is difficult to reverse
- Affects multiple systems
- Changes a major architectural pattern
- Will likely be questioned later

ADR format:

```text
# Decision

## Context

## Problem

## Options

## Decision

## Why

## Tradeoffs

## Consequences

## Status
```

---

## 36. Architecture Output Format

When asked to architect a feature, Claude should return:

```text
# 1. SCOPE

What is included?
What is excluded?

# 2. CURRENT SYSTEM

Relevant existing behavior and files.

# 3. REQUIREMENTS

Functional requirements.

# 4. ASSUMPTIONS

Explicit assumptions only.

# 5. UNKNOWNs

Missing information.

# 6. HUMAN DECISIONS REQUIRED

Decisions that should not be guessed.

# 7. PROPOSED ARCHITECTURE

Components and responsibilities.

# 8. DATA FLOW

Input → processing → storage → output.

# 9. DATA MODEL

Tables/entities and relationships.

# 10. API / INTEGRATIONS

Internal and external interfaces.

# 11. SECURITY

Auth, authorization, tenant isolation, secrets,
webhooks, validation, privacy.

# 12. FAILURE MODES

Timeouts, retries, duplicates, provider failures.

# 13. TEST STRATEGY

Happy path + failure + security + regression.

# 14. IMPLEMENTATION PLAN

Small sequential steps.

# 15. ACCEPTANCE CRITERIA

Observable Definition of Done.

# 16. RISKS / TRADEOFFS

Important tradeoffs.

# 17. FINAL STATUS

CONFIRMED / PROPOSED / HUMAN DECISION REQUIRED
```

---

## 37. SEctOr-Specific Architecture Principle

SEctOr should create a continuous intelligence loop:

```text
COLLECT
   ↓
UNDERSTAND
   ↓
DIAGNOSE
   ↓
PRIORITIZE
   ↓
CREATE
   ↓
APPROVE
   ↓
EXECUTE
   ↓
VERIFY
   ↓
MEASURE
   ↓
LEARN
   ↺
```

The platform should not merely generate recommendations.

It should eventually connect:

```text
Problem
→ Recommendation
→ Action
→ Evidence
→ Outcome
```

This is more valuable than isolated AI outputs.

---

## 38. First-Principles Rule

Every major feature should answer:

```text
What user problem are we solving?
Why does this need to exist?
What is the smallest useful version?
What evidence proves it works?
```

If the feature cannot answer these questions, stop before implementation.

---

## 39. Final Architecture Gate

Before approving implementation, confirm:

- [ ] Scope is clear
- [ ] Out-of-scope items are explicit
- [ ] Existing code was explored
- [ ] Data sources are known
- [ ] Important values have sources
- [ ] Architecture is simple
- [ ] Tenant isolation is defined
- [ ] Authentication/authorization are defined
- [ ] External failures are considered
- [ ] Idempotency is considered
- [ ] Acceptance criteria are observable
- [ ] Tests are defined
- [ ] Verification is defined
- [ ] Rollback is considered
- [ ] Unknowns are visible
- [ ] Human decisions are explicit
- [ ] No silent scope creep exists

Only then:

```text
APPROVE → BUILD
```

---

## 40. Recommended Claude Project Structure

```text
SEctOr/
│
├── CLAUDE.md
│
├── docs/
│   ├── product.md
│   ├── architecture.md
│   ├── conventions.md
│   ├── security.md
│   ├── decisions/
│   ├── plans/
│   └── runbooks/
│
├── skills/
│   ├── seo.md
│   ├── geo.md
│   ├── aio.md
│   ├── ad-grants.md
│   ├── content.md
│   ├── social.md
│   ├── campaigns.md
│   ├── brand.md
│   ├── csr.md
│   └── impact.md
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── ai/
│   ├── connectors/
│   ├── skills/
│   ├── content/
│   ├── analytics/
│   └── shared/
│
├── services/
│   ├── crawler/
│   ├── social/
│   └── workers/
│
└── tests/
```

Adjust this structure to the actual repository rather than creating folders simply because they appear here.

---

## 41. Short Claude Architecture Prompt

Use this for normal architecture sessions:

```text
Use the SEctOr AI Architecture Protocol in
docs/AI_ARCHITECTURE_PROTOCOL.md.

I want to architect:

[FEATURE]

Do not modify code yet.

First:

1. SCOPE the feature.
2. EXPLORE the existing repository.
3. Identify relevant product, architecture, Skill Files,
   source code, integrations, and tests.
4. Identify existing patterns we should reuse.
5. Identify unknowns and HUMAN DECISIONS REQUIRED.
6. Propose the smallest practical architecture.
7. Define data flow, data model, APIs, security,
   failure handling, tests, acceptance criteria,
   implementation plan, and rollback.
8. Mark decisions as CONFIRMED, PROPOSED, UNKNOWN,
   or HUMAN DECISION REQUIRED.

Do not silently invent product requirements,
business rules, APIs, database fields, or architecture.

Do not implement until I approve the architecture.
```

---

## 42. Implementation Prompt

After architecture approval:

```text
Implement the approved architecture for:

[FEATURE]

Follow:

docs/AI_ARCHITECTURE_PROTOCOL.md
CLAUDE.md
the approved architecture/plan
relevant Skill Files

Rules:

- Do not expand scope.
- Reuse existing patterns.
- Make the smallest useful change.
- Do not invent APIs or business rules.
- Do not modify unrelated systems.
- Stop if the approved architecture becomes invalid.
- Stop for security, data, auth, or destructive ambiguity.
- Add appropriate tests.
- Run verification.
- Report exactly what was changed.
- Report tests and verification actually performed.
- Report anything UNVERIFIED.
- Show the final diff summary.
```

---

## 43. Review Prompt

Use a separate AI/session for independent review when practical:

```text
Review the implementation of:

[FEATURE]

Read:

- CLAUDE.md
- docs/AI_ARCHITECTURE_PROTOCOL.md
- approved plan
- relevant source code
- relevant tests

Do not rewrite the feature.

Act as an independent reviewer.

Check:

1. Correctness
2. Requirements
3. Security
4. Tenant isolation
5. Authentication
6. Authorization
7. Data integrity
8. Race conditions
9. Validation
10. Error handling
11. External integration failures
12. Idempotency
13. Backward compatibility
14. Tests
15. Complexity
16. Scope creep

Return findings by severity:

CRITICAL
HIGH
MEDIUM
LOW

If there are no findings, say so explicitly.

Do not assume that passing tests means
the real user workflow is correct.
```

---

## 44. Operating Mental Model

Remember:

```text
LESS INPUT
    ↓
BETTER CONTEXT
    ↓
BETTER PLAN
    ↓
SMALLER CHANGE
    ↓
FASTER VERIFICATION
    ↓
LESS REWORK
    ↓
LOWER COST
    ↓
HIGHER LEVERAGE
```

The purpose is not to slow AI development.

It is to prevent AI from moving fast in the wrong direction.

---

## 45. Final Rule

> Never let AI silently decide an important product,
> architecture, security, data, or irreversible-action decision.

AI should make engineering faster.

The engineering system should make AI safer.

Human:

```text
Product
Risk
Priority
Approval
```

AI:

```text
Explore
Reason
Plan
Build
Test
Review
Document
```

Together:

```text
DEFINE
→ EXPLORE
→ PLAN
→ APPROVE
→ BUILD
→ TEST
→ REVIEW
→ VERIFY
→ SHIP
→ LEARN
```

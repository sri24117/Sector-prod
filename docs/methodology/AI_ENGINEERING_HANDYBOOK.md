# AI Engineering Handybook

## Modern, High-Leverage, Low-Token Workflows for MVP → Production

> **Core principle:** Don't use an AI coding agent as a code generator.
> Use it as an engineering system: **Context → Explore → Plan → Build →
> Verify → Review → Ship → Learn**.

------------------------------------------------------------------------

## 0. The Mental Model

The goal is not:

``` text
Write more prompts
```

The goal is:

``` text
Better context
+ smaller tasks
+ better plans
+ reusable rules
+ concrete verification
= less rework + fewer tokens + better software
```

### The Golden Rule

**Automate repetition. Gate irreversible actions.**

Let agents freely read, search, test, format, and inspect.

Require human approval for production deployment, destructive database
operations, secrets, force-pushes, and major architecture changes.

------------------------------------------------------------------------

# 1. The Master Workflow

Use this loop for meaningful work:

``` text
IDEA / BUG
   ↓
CLARIFY
   ↓
EXPLORE
   ↓
PLAN
   ↓
APPROVE
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
COMMIT / PR
   ↓
LEARN
```

For tiny changes, compress the loop.

For risky changes, expand it.

### Never skip verification just because the code compiles.

``` text
Compiles ≠ Correct
Tests pass ≠ Requirements satisfied
Looks good ≠ Production ready
```

------------------------------------------------------------------------

# 2. Context Is the First Optimization

AI performance is heavily affected by the context it has to process.

Bad:

``` text
Huge repo
+ huge chat
+ unrelated tasks
+ many tools
+ vague requirements
```

Good:

``` text
Relevant files
+ project rules
+ focused task
+ acceptance criteria
+ reference implementation
```

## Context hierarchy

``` text
1. Global engineering rules
2. Project rules
3. Architecture / domain docs
4. Relevant source files
5. Current task
6. Acceptance criteria
```

Give the agent the smallest context that is sufficient.

------------------------------------------------------------------------

# 3. CLAUDE.md / Project Instructions

Maintain two layers.

## Global rules

Things that apply to almost every repository:

-   Prefer simple solutions.
-   Reuse existing patterns.
-   Do not modify unrelated files.
-   Never invent APIs, schema fields, or business rules.
-   Run relevant tests after changes.
-   Never expose secrets.
-   Never force-push.
-   Never push directly to `main`.
-   Ask before destructive operations.
-   Do not claim something works without verification.

## Project rules

Things specific to the repository:

-   Tech stack
-   Run commands
-   Architecture
-   Folder conventions
-   Database rules
-   Authentication rules
-   API conventions
-   Testing commands
-   Deployment constraints
-   Domain-specific safety rules

### Keep the file small.

Use this test:

> **If removing a rule would not cause the agent to make a mistake,
> remove it.**

Do not turn project instructions into a 600-line encyclopedia.

------------------------------------------------------------------------

# 4. One Task = One Context

Avoid the kitchen-sink session.

Bad:

``` text
Fix login
↓
Build dashboard
↓
Change database
↓
Redesign UI
↓
Add WhatsApp
↓
Fix another bug
```

Good:

``` text
Session 1 → Fix login

Session 2 → Dashboard

Session 3 → WhatsApp
```

Why?

Unrelated history becomes context noise.

### When the task gets too long

Use:

``` text
/compact
```

or start a fresh session with a concise continuation summary.

A clean session with good context usually beats a giant stale session.

------------------------------------------------------------------------

# 5. Scope Before You Search

Never start with:

> "Investigate the entire codebase."

Instead:

``` text
Investigate appointment booking.

Focus on:
- appointment API
- appointment service
- appointment model
- booking UI
- related tests

Do not inspect unrelated areas unless necessary.
```

### Scope rule

``` text
Unknown problem
    ↓
Find the smallest relevant surface
    ↓
Understand it
    ↓
Expand only when evidence requires it
```

This reduces context usage and prevents accidental changes.

------------------------------------------------------------------------

# 6. EXPLORE Mode

Use exploration when you don't yet understand the system.

### Prompt

``` text
Explore the relevant part of this repository.

Do not modify files.

Goal:
Understand how [FEATURE] currently works.

Trace:
- entry point
- request flow
- business logic
- database interaction
- external services
- error handling
- tests

Return:
1. Current flow
2. Important files
3. Existing patterns
4. Constraints
5. Potential risks
6. Unknowns

Keep the investigation scoped to [AREA].
```

### Good exploration questions

``` text
Where does this request enter the system?

Where is authentication checked?

Where is authorization checked?

Where is the database updated?

Where does this external API get called?

Where does retry logic live?

What happens when this operation fails?

Which tests protect this behavior?
```

------------------------------------------------------------------------

# 7. PLAN Mode

Planning is one of the highest-leverage activities.

Before implementation, ask:

``` text
Create an implementation plan.

Do not modify files.

Include:
- objective
- current behavior
- desired behavior
- files to change
- files not to change
- data/API implications
- edge cases
- security risks
- testing strategy
- rollback considerations
- definition of done

Prefer the smallest viable implementation.
Stop and flag assumptions instead of inventing requirements.
```

## Plan quality test

A good plan should tell you:

``` text
WHAT changes?
WHERE?
WHY?
WHAT could break?
HOW will we prove it works?
```

If the plan is unexpectedly huge:

**split the task.**

------------------------------------------------------------------------

# 8. Use Existing Code as a Reference

Examples are often better than long instructions.

Instead of:

``` text
Create a component that follows our design system...
```

Use:

``` text
Use `PatientCard.tsx` as the reference implementation.

Match:
- component structure
- loading behavior
- error handling
- styling conventions
- data-fetching pattern

Do not copy blindly.
Reuse shared utilities where appropriate.
```

Reference:

``` text
Existing good pattern
        ↓
New implementation
```

This reduces ambiguity and unnecessary prompting.

------------------------------------------------------------------------

# 9. The Four-Part Task Prompt

For important tasks, provide four things:

## 1. Task / Goal

What needs to happen?

## 2. Intent

Why does it matter?

## 3. Guardrails

What must not happen?

## 4. Done

How do we know it is complete?

### Template

``` text
TASK
Implement [FEATURE].

INTENT
The purpose is [WHY].
The user should be able to [OUTCOME].

GUARDRAILS
- Do not change unrelated behavior.
- Follow existing architecture.
- Do not invent business rules.
- Preserve backward compatibility.
- Do not expose sensitive data.
- Stop if an architectural assumption is invalid.

DONE WHEN
- [Acceptance criterion]
- [Acceptance criterion]
- [Acceptance criterion]
- Relevant tests pass.
- Diff contains only intended changes.
```

------------------------------------------------------------------------

# 10. Acceptance Criteria = The Contract

Never rely only on natural-language instructions.

Write observable outcomes.

Bad:

``` text
Make booking better.
```

Good:

``` text
✓ User can select an available slot.
✓ Already-booked slots cannot be selected.
✓ Invalid slots return a clear error.
✓ Appointment is persisted.
✓ Confirmation is sent.
✓ Duplicate booking is prevented.
✓ Clinic isolation is enforced.
✓ Failure is logged.
```

The agent should be able to test each item.

------------------------------------------------------------------------

# 11. Build Small Vertical Slices

Avoid building an entire product layer-by-layer.

Bad:

``` text
Build all frontend
↓
Build all backend
↓
Build database
↓
Integrations
↓
Testing
```

Better:

``` text
Feature 1
UI → API → DB → Test

Feature 2
UI → API → DB → Test

Feature 3
UI → API → Integration → Test
```

Each slice should produce a working increment.

### MVP principle

**Ship the smallest complete workflow, not the largest incomplete
architecture.**

------------------------------------------------------------------------

# 12. BUILD Mode

Once the plan is approved:

``` text
Implement the approved plan.

Rules:
- Stay within scope.
- Work in small increments.
- Reuse existing patterns.
- Run relevant tests as you progress.
- Do not refactor unrelated code.
- Do not invent requirements.
- Stop if the approved plan becomes invalid.
- Report blockers rather than improvising around them.
```

------------------------------------------------------------------------

# 13. STOP Conditions

Agents should know when to stop.

Stop and ask when:

-   Database architecture needs to change.
-   Authentication behavior needs to change.
-   A new external service is required.
-   Requirements conflict.
-   Existing tests contradict the specification.
-   More files need changing than expected.
-   A security-sensitive decision is unclear.
-   A destructive command is required.
-   The implementation requires a new architectural pattern.

### Principle

**A controlled stop is better than a clever wrong assumption.**

------------------------------------------------------------------------

# 14. TEST Mode

Don't ask only:

> "Run the tests."

Ask what behavior needs proof.

``` text
Test this feature against:

Happy path
Invalid input
Missing data
Boundary conditions
Duplicate requests
Unauthorized access
Failure from dependencies
Concurrency where relevant
Backward compatibility
```

## Test pyramid

``` text
Unit
 ↓
Integration
 ↓
API / contract
 ↓
End-to-end
 ↓
Manual verification
```

Use the smallest level that proves the behavior, but don't avoid
higher-level verification when integration risk is high.

------------------------------------------------------------------------

# 15. VERIFY Mode

Verification is separate from implementation.

### Prompt

``` text
Verify the completed feature.

Check:
1. Acceptance criteria
2. Relevant automated tests
3. Type checking
4. Linting / formatting
5. Error handling
6. Security boundaries
7. Regression risk
8. Actual user-visible behavior

Report:

PASS:
...

FAIL:
...

UNVERIFIED:
...

Do not claim completion for anything that was not verified.
```

### Strong verification uses evidence

``` text
Test result
+
API response
+
Database state
+
Screenshot / UI behavior
+
Git diff
```

------------------------------------------------------------------------

# 16. Independent Review

The model that wrote the code should not be the only judge of the code.

Use a second agent/model when risk justifies it.

``` text
Builder
   ↓
Code
   ↓
Independent Reviewer
   ↓
Findings
   ↓
Builder fixes
   ↓
Verification
```

### Review prompt

``` text
Review this implementation independently.

Do not modify code.

Look for:
- correctness bugs
- security vulnerabilities
- authorization problems
- data leakage
- race conditions
- validation gaps
- error handling problems
- backwards compatibility issues
- missing tests
- unnecessary complexity
- unrelated changes

Prioritize findings by severity.

For every finding provide:
- location
- problem
- why it matters
- suggested direction
```

### Important

Independent review is most valuable for:

-   Authentication
-   Payments
-   Database migrations
-   Multi-tenancy
-   Healthcare / sensitive data
-   Security-sensitive APIs
-   Infrastructure
-   Production incidents

For trivial UI copy, it may be unnecessary.

------------------------------------------------------------------------

# 17. Multi-Agent Architecture

Think of agents as specialists.

``` text
                 YOU
                  ↓
             ORCHESTRATOR
                  ↓
       ┌──────────┼──────────┐
       ↓          ↓          ↓
    Explorer    Builder    Reviewer
       ↓          ↓          ↓
    findings     code      findings
       └──────────┼──────────┘
                  ↓
              VERIFIER
                  ↓
                SHIP
```

## Model specialization

Use the strongest model where reasoning matters most:

``` text
Architecture
Complex debugging
Security reasoning
Final review
```

Use cheaper/faster models where the work is mostly:

``` text
Reading
Summarizing
Classification
Repetitive transformation
Boilerplate
```

### Important

Don't optimize for the cheapest token.

Optimize for:

``` text
Total cost of correct outcome
=
model cost
+
iteration cost
+
human time
+
failure cost
```

------------------------------------------------------------------------

# 18. Sub-Agent Pattern

For large research/reading tasks:

``` text
                Main Agent
                    ↓
          delegates heavy reading
                    ↓
       ┌────────┬────────┬────────┐
       ↓        ↓        ↓        ↓
    Agent A  Agent B  Agent C  Agent D
       ↓        ↓        ↓        ↓
    summary  summary  summary  summary
       └────────┴────────┴────────┘
                    ↓
               Main Agent
                    ↓
              Final synthesis
```

Use sub-agents when the task contains a lot of independent reading or
research.

Don't create sub-agents for tiny tasks.

------------------------------------------------------------------------

# 19. Token Efficiency Rules

## Rule 1 --- Start clean

Don't carry unrelated conversations.

## Rule 2 --- Scope exploration

Don't scan 500 files when 8 files matter.

## Rule 3 --- Plan upfront

Reduce repeated corrections.

## Rule 4 --- Use references

Show existing patterns instead of describing them endlessly.

## Rule 5 --- Delegate repetitive work

Use smaller agents for reading/classification/summarization when
appropriate.

## Rule 6 --- Use lower effort for simple iterations

Example:

``` text
Complex architecture → high reasoning
Small UI tweak → lower reasoning
```

## Rule 7 --- Don't over-instruct

Avoid unnecessary instructions such as:

``` text
"Think step-by-step"
"Double-check everything twice"
"Be maximally thorough"
```

If the model already performs these behaviors, extra instructions can
create unnecessary work.

## Rule 8 --- Don't ask for huge output

If you need a decision, ask for a decision.

If you need code, ask for code.

If you need a plan, ask for a plan.

**Output size is part of context management.**

------------------------------------------------------------------------

# 20. Context Budgeting

Treat context like RAM.

``` text
Context
├── System instructions
├── Project rules
├── Tools
├── Conversation
├── Files
└── Current task
```

Your goal is not:

> "Use the maximum context."

Your goal is:

> **Use the minimum context that allows a correct decision.**

### Context hygiene

When context becomes noisy:

``` text
Compact
or
Start a fresh session
```

When starting fresh, carry forward:

``` text
Goal
Current state
Completed work
Remaining work
Important decisions
Known failures
Next action
```

------------------------------------------------------------------------

# 21. Git as a Safety System

Use Git checkpoints.

``` text
main
  │
  ├── feature/booking
  ├── fix/auth
  └── feature/whatsapp
```

Recommended:

``` text
Explore
↓
Plan
↓
Feature branch
↓
Build
↓
Verify
↓
Review
↓
Commit
↓
PR
↓
Human approval
↓
Merge
```

Never let agent convenience bypass your safety boundary.

------------------------------------------------------------------------

# 22. Diff Is a Product Artifact

Before committing:

``` text
Review the current git diff.

Check:
- Did only intended files change?
- Are there accidental changes?
- Are secrets exposed?
- Are migrations safe?
- Are tests included?
- Are comments/docs accurate?
- Is the implementation larger than necessary?
```

A clean diff is evidence of controlled execution.

------------------------------------------------------------------------

# 23. Production Readiness Checklist

Before shipping:

### Functionality

``` text
□ Acceptance criteria pass
□ Happy path works
□ Failure paths work
□ Edge cases handled
```

### Security

``` text
□ Authentication checked
□ Authorization checked
□ Tenant isolation checked
□ Secrets protected
□ Sensitive data protected
□ External webhooks validated
```

### Reliability

``` text
□ Errors handled
□ Retries appropriate
□ Idempotency considered
□ Timeouts considered
□ Logs useful
```

### Quality

``` text
□ Tests pass
□ Type checking passes
□ Lint passes
□ Diff reviewed
□ No unrelated changes
```

### Operations

``` text
□ Migration understood
□ Rollback understood
□ Environment variables documented
□ Monitoring/logging considered
```

------------------------------------------------------------------------

# 24. The MVP Feature Card

Before implementing a feature, create:

``` md
# Feature: [Name]

## Goal
[What are we trying to achieve?]

## User
[Who uses it?]

## Why
[Why does it matter?]

## Current behavior
[What happens today?]

## Desired behavior
[What should happen?]

## Acceptance Criteria
- [ ]
- [ ]
- [ ]

## Guardrails
- [ ]
- [ ]
- [ ]

## Relevant Files
- [ ]
- [ ]

## Risks
- [ ]
- [ ]

## Verification
- [ ]
- [ ]

## Definition of Done
[One sentence]
```

This becomes the contract between you and the agent.

------------------------------------------------------------------------

# 25. The "Smallest Useful Change" Rule

Whenever an agent proposes:

``` text
12 files
3 abstractions
2 new services
1 framework
```

Ask:

``` text
Can this be implemented with fewer moving parts?

What is the smallest production-safe solution?
```

Prefer:

``` text
5 files
1 clear abstraction
existing infrastructure
```

over:

``` text
20 files
new architecture
new dependency
```

unless the larger design is genuinely necessary.

------------------------------------------------------------------------

# 26. Don't Let Agents "Improve Everything"

A dangerous prompt:

``` text
Make the code better.
```

It creates scope creep.

Use:

``` text
Fix [specific issue].

Do not:
- refactor unrelated code
- rename unrelated variables
- change architecture
- upgrade dependencies
- redesign adjacent components
```

### Rule

**Correctness first. Cleanup separately.**

------------------------------------------------------------------------

# 27. The 3-Level Workflow

Not every task needs the full process.

## Level 1 --- Tiny

Example:

``` text
Fix typo
Change label
Small CSS adjustment
```

Workflow:

``` text
Task → Change → Quick check
```

## Level 2 --- Normal

Example:

``` text
New API endpoint
Dashboard feature
CRUD operation
```

Workflow:

``` text
Explore → Plan → Build → Test → Review → Commit
```

## Level 3 --- High Risk

Example:

``` text
Auth
Payments
Database migration
Multi-tenancy
Production infrastructure
Sensitive data
```

Workflow:

``` text
Explore
→ Plan
→ Human approval
→ Build
→ Tests
→ Independent review
→ Security review
→ Manual verification
→ Rollback check
→ PR
→ Human approval
→ Ship
```

------------------------------------------------------------------------

# 28. The "Evidence Ladder"

When deciding whether something is done:

``` text
Level 0
"It looks right."

Level 1
"Code compiles."

Level 2
"Unit tests pass."

Level 3
"Integration tests pass."

Level 4
"Real workflow works."

Level 5
"Independent review found no blocking issue."

Level 6
"Production monitoring confirms behavior."
```

For high-risk work, climb higher.

------------------------------------------------------------------------

# 29. The AI Engineering Flywheel

Every completed feature should improve the next feature.

``` text
Build
 ↓
Discover repeated problem
 ↓
Document it
 ↓
Update project rules
 ↓
Create reusable utility/pattern
 ↓
Next feature becomes faster
```

Examples:

If agents repeatedly forget:

``` text
clinic_id filtering
```

Add it to project rules.

If they repeatedly implement:

``` text
API error responses
```

Create a shared pattern.

If they repeatedly forget:

``` text
webhook verification
```

Add a reusable helper + test.

**The repo should become smarter over time.**

------------------------------------------------------------------------

# 30. Build a Project Knowledge Layer

Recommended:

``` text
docs/
├── architecture.md
├── product.md
├── conventions.md
├── decisions/
│   ├── 001-auth.md
│   ├── 002-database.md
│   └── 003-payments.md
├── plans/
└── runbooks/
```

Keep permanent knowledge out of chat whenever possible.

### Chat = temporary working memory

### Docs = durable project memory

------------------------------------------------------------------------

# 31. Architecture Decision Records

When making an important decision:

``` md
# ADR-003: Use PostgreSQL

## Decision
Use PostgreSQL as the primary database.

## Why
- relational data
- transaction support
- existing team knowledge
- deployment compatibility

## Alternatives
- MongoDB
- SQLite

## Consequences
[What this decision makes easier/harder]
```

This prevents future agents from repeatedly reopening already-settled
decisions.

------------------------------------------------------------------------

# 32. Prompt Templates

## Explore

``` text
Explore [AREA].

Do not modify anything.

Explain the current implementation, relevant files,
data flow, dependencies, constraints, and risks.

Stay scoped to [AREA].
```

## Plan

``` text
Create a minimal production-safe implementation plan for [TASK].

Do not modify files.

Include:
- files to change
- behavior changes
- risks
- edge cases
- tests
- definition of done

Flag unknowns instead of guessing.
```

## Build

``` text
Implement the approved plan for [TASK].

Stay within scope.
Reuse existing patterns.
Do not invent requirements.
Run relevant tests.
Stop if the plan becomes invalid.
```

## Verify

``` text
Verify [TASK] against its acceptance criteria.

Run relevant tests and checks.
Inspect the diff.
Identify PASS, FAIL, and UNVERIFIED items.
```

## Review

``` text
Review the current diff independently.

Focus on correctness, security, regressions,
edge cases, maintainability, and missing tests.

Do not modify code.
Return prioritized findings.
```

## Commit

``` text
Prepare this change for commit.

First inspect the diff.
Ensure only intended files changed.
Summarize the change.
Suggest a concise commit message.
Do not push to main.
```

------------------------------------------------------------------------

# 33. The 10-Minute Feature Method

For a straightforward feature:

``` text
Minute 0–2
Clarify goal + acceptance criteria

Minute 2–4
Explore relevant code

Minute 4–5
Plan

Minute 5–8
Implement smallest slice

Minute 8–10
Test + inspect diff
```

For complex work, don't force a 10-minute limit. Increase planning and
verification instead.

------------------------------------------------------------------------

# 34. The Modern "AI Pair Programmer" Pattern

Think:

``` text
YOU
│
├── Product decisions
├── Tradeoffs
├── Risk acceptance
└── Final approval
│
AI
│
├── Search
├── Coding
├── Testing
├── Documentation
├── Refactoring
└── Analysis
```

Don't delegate decisions that require business ownership without
reviewing them.

------------------------------------------------------------------------

# 35. Anti-Patterns

## ❌ Giant prompt

``` text
Build the entire SaaS.
```

## ❌ Giant context

``` text
Read the entire repository.
```

## ❌ Giant session

``` text
20 unrelated tasks in one chat.
```

## ❌ Blind trust

``` text
"Tests passed, ship it."
```

## ❌ Self-review only

``` text
Agent writes code → same agent says it is perfect.
```

## ❌ Scope creep

``` text
Fix login → rewrite authentication architecture.
```

## ❌ Premature optimization

``` text
MVP → microservices + event bus + Kubernetes
```

## ❌ Tool explosion

``` text
50 connectors enabled
but only 3 are relevant
```

------------------------------------------------------------------------

# 36. The Ultimate Operating System

For every meaningful engineering task:

``` text
┌───────────────────────────┐
│ 1. DEFINE                 │
│ Goal + Why + Done         │
└─────────────┬─────────────┘
              ↓
┌───────────────────────────┐
│ 2. EXPLORE                │
│ Small relevant context    │
└─────────────┬─────────────┘
              ↓
┌───────────────────────────┐
│ 3. PLAN                   │
│ Files + risks + tests     │
└─────────────┬─────────────┘
              ↓
         HUMAN GATE
              ↓
┌───────────────────────────┐
│ 4. BUILD                  │
│ Small vertical slice      │
└─────────────┬─────────────┘
              ↓
┌───────────────────────────┐
│ 5. TEST                   │
│ Behavior + edge cases     │
└─────────────┬─────────────┘
              ↓
┌───────────────────────────┐
│ 6. REVIEW                 │
│ Independent challenge     │
└─────────────┬─────────────┘
              ↓
┌───────────────────────────┐
│ 7. VERIFY                 │
│ Evidence, not confidence   │
└─────────────┬─────────────┘
              ↓
┌───────────────────────────┐
│ 8. SHIP                   │
│ Commit → PR → approval    │
└─────────────┬─────────────┘
              ↓
┌───────────────────────────┐
│ 9. LEARN                  │
│ Docs + rules + patterns   │
└───────────────────────────┘
```

------------------------------------------------------------------------

# 37. The One-Page Cheat Sheet

``` text
BEFORE CODING
─────────────
□ What is the goal?
□ Why?
□ What does done mean?
□ What must not change?
□ What are the risks?

EXPLORE
───────
□ Find relevant files
□ Trace data flow
□ Find existing patterns
□ Find tests

PLAN
────
□ Minimal solution
□ Files to change
□ Risks
□ Tests
□ Rollback

BUILD
─────
□ Small slice
□ Reuse patterns
□ Stay in scope
□ Stop on ambiguity

VERIFY
──────
□ Acceptance criteria
□ Tests
□ Real behavior
□ Security
□ Git diff

REVIEW
──────
□ Independent reviewer for risky work
□ Fix valid findings

SHIP
────
□ Clean diff
□ Commit
□ PR
□ Human approval

LEARN
─────
□ Record important decision
□ Improve reusable pattern
□ Update rules if needed
```

------------------------------------------------------------------------

# 38. Final Principles

1.  **Context before code.**
2.  **Explore before planning.**
3.  **Plan before implementation.**
4.  **Build the smallest complete slice.**
5.  **Use existing code as a reference.**
6.  **Make acceptance criteria observable.**
7.  **Automate repetitive work.**
8.  **Use cheaper agents for suitable repetitive work.**
9.  **Keep one task per context.**
10. **Keep context small and relevant.**
11. **Never confuse compilation with correctness.**
12. **Use independent review for important changes.**
13. **Gate irreversible actions.**
14. **Use Git as a safety net.**
15. **Document decisions, not everything.**
16. **Turn repeated mistakes into rules or reusable code.**
17. **Prefer simple architecture until complexity is justified.**
18. **Optimize total engineering time, not token price alone.**
19. **Human owns product decisions and risk.**
20. **The goal is not maximum AI activity. The goal is maximum useful
    output per unit of attention.**

------------------------------------------------------------------------

# 39. The Ultimate Mental Model

``` text
              LESS INPUT
                  ↓
          BETTER CONTEXT
                  ↓
           BETTER PLAN
                  ↓
          SMALLER CHANGE
                  ↓
          FASTER VERIFY
                  ↓
          LESS REWORK
                  ↓
          LOWER TOKEN COST
                  ↓
          HIGHER LEVERAGE
```

### The real superpower

**Don't make the AI work harder. Make the system make the AI's work more
valuable.**

------------------------------------------------------------------------

## Recommended Default

For most production features:

``` text
DEFINE
  ↓
EXPLORE
  ↓
PLAN
  ↓
APPROVE
  ↓
BUILD
  ↓
TEST
  ↓
REVIEW
  ↓
VERIFY
  ↓
PR
  ↓
SHIP
  ↓
LEARN
```

**This is the default operating system. Adapt it to the risk and size of
the task rather than blindly following every step.**

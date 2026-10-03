# METHOD.md --- Self-Improving Agent Build Loop

## 1. Objective

Build software features through a repeatable agent loop where:

1.  Requirements are defined.
2.  Verification checks are written **before implementation**.
3.  Checks are locked so the agent cannot weaken them.
4.  A fresh feature-builder agent implements the feature.
5.  The feature is executed and tested.
6.  Failed attempts are reverted/fixed.
7.  Results are recorded.
8.  A second learning loop identifies recurring mistakes and improves
    the workflow itself.

**Core principle:**

> The agent should not be trusted to judge its own work. The
> specification and verification system must judge the work.

------------------------------------------------------------------------

# 2. When to Use This Method

Use the loop when the task has:

-   A repeatable implementation pattern.
-   A clear definition of success.
-   Automated or deterministic checks.
-   A runnable application/test environment.
-   Enough complexity that repeated agent attempts create leverage.

Do **not** use it for:

-   One-off trivial tasks.
-   Tasks with no objective verification.
-   Features where success depends entirely on subjective human
    judgment.
-   Building an entire application in one giant loop.

Prefer:

> One feature → one verification boundary → one controlled loop.

------------------------------------------------------------------------

# 3. Core Architecture

``` text
                    ┌────────────────────┐
                    │   PROJECT CONTEXT  │
                    │ memory / rules /   │
                    │ architecture       │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │    BUILD SKILL     │
                    │ orchestrates loop  │
                    └─────────┬──────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
      ┌────────────────┐            ┌────────────────┐
      │  WRITE CHECKS  │            │ FEATURE BUILDER│
      │ specification  │            │ implementation │
      └───────┬────────┘            └───────┬────────┘
              │                             │
              ▼                             ▼
      ┌────────────────┐            ┌────────────────┐
      │ APPROVE / LOCK │            │ Run application│
      │ immutable test │            │ + checks       │
      └───────┬────────┘            └───────┬────────┘
              │                             │
              └──────────────┬──────────────┘
                             ▼
                    ┌────────────────────┐
                    │   RESULTS FILE     │
                    │ pass/fail, attempt │
                    │ changes, failures  │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │     AUTO LOOP      │
                    │ detect recurring   │
                    │ agent mistakes     │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │    PROGRAM.MD      │
                    │ improved workflow  │
                    └────────────────────┘
```

------------------------------------------------------------------------

# 4. Project Context

Create a project-context skill containing the durable knowledge required
by every agent.

It should describe:

-   What the product does.
-   Product goals.
-   Pages/screens.
-   Main user workflows.
-   Architecture.
-   Tech stack.
-   Database conventions.
-   API conventions.
-   UI conventions.
-   Naming conventions.
-   Security rules.
-   Things the agent must never do.
-   Known technical constraints.
-   Existing implementation patterns.
-   Important business rules.

## Rule

The project context is the **source of truth for project-specific
knowledge**.

Keep the always-visible description short. Load detailed context only
when needed.

The context must evolve as the product evolves.

------------------------------------------------------------------------

# 5. Feature Definition

Every feature must have an explicit definition before implementation.

Recommended structure:

``` text
Feature:
    <feature name>

Goal:
    <user/business outcome>

Inputs:
    <required inputs>

Expected behavior:
    <observable behavior>

Constraints:
    <technical/business/security constraints>

Acceptance criteria:
    <specific measurable outcomes>

Out of scope:
    <things this feature must not change>
```

Example:

``` text
Feature:
    Guest food pickup ordering

Goal:
    Allow a guest to order food for pickup.

Acceptance criteria:
    1. Guest can select products.
    2. Guest can specify quantity.
    3. Guest must provide a valid email.
    4. Order is persisted.
    5. Confirmation is displayed.
    6. Existing ordering rules continue to work.
```

------------------------------------------------------------------------

# 6. Write Checks Before Code

The verification layer must exist before the feature implementation.

The check writer should:

1.  Understand the feature.
2.  Inspect existing architecture.
3.  Identify expected behavior.
4.  Identify edge cases.
5.  Write executable checks.
6.  Explain every check in plain language.

Example:

``` text
CHECK-01
Guest can select a product.

CHECK-02
Guest can specify quantity.

CHECK-03
Invalid email is rejected.

CHECK-04
Valid email is accepted.

CHECK-05
Order is persisted.

CHECK-06
Confirmation is shown.

CHECK-07
Existing ordering behavior is not broken.
```

## Important

Checks must test the **real behavior**, not merely whether code exists.

Bad:

``` text
Function createOrder() exists.
```

Good:

``` text
Submitting a valid order creates exactly one persisted order.
```

------------------------------------------------------------------------

# 7. Human Approval Gate

Before implementation:

``` text
Agent → proposes checks
        ↓
Human reviews checks
        ↓
Human approves
        ↓
Checks become immutable
        ↓
Implementation begins
```

The human's most important job is not writing code.

It is validating:

> "Are these actually the right things to test?"

Once approved, checks must be locked.

------------------------------------------------------------------------

# 8. Immutable Verification

Approved checks must be stored in a protected location.

Example:

``` text
checks/
    approved/
        feature-001/
            check-01
            check-02
            check-03
```

The feature-building agent must not be allowed to modify:

``` text
checks/approved/**
```

## Security principle

Never allow the system being evaluated to modify the evaluation
criteria.

Otherwise the agent can produce:

``` text
Better result
```

by changing:

``` text
What counts as a better result
```

That destroys the feedback loop.

------------------------------------------------------------------------

# 9. Build Skill

The Build Skill is the orchestrator.

Its responsibilities:

1.  Load project context.
2.  Load feature definition.
3.  Ensure checks exist.
4.  Get human approval.
5.  Lock approved checks.
6.  Start feature-builder.
7.  Run checks.
8.  Capture results.
9.  Retry failed implementation.
10. Stop when acceptance criteria are satisfied.
11. Generate a final report.

The Build Skill should **not** implement the feature itself.

It coordinates specialized agents.

------------------------------------------------------------------------

# 10. Feature Builder Agent

Every feature should start with a fresh builder context.

Responsibilities:

``` text
Read:
    project context
    feature definition
    approved checks
    existing code

Then:
    inspect architecture
    implement smallest correct change
    run checks
    inspect failures
    fix implementation
    rerun checks
```

The builder may modify implementation code.

The builder may **not** modify:

``` text
approved checks
```

------------------------------------------------------------------------

# 11. Fresh Context Per Feature

Do not allow one giant agent context to accumulate every feature.

Use:

``` text
Feature 1 → fresh builder
Feature 2 → fresh builder
Feature 3 → fresh builder
```

This reduces:

-   Context pollution.
-   Accidental assumptions.
-   Irrelevant history.
-   Cognitive load.

However, fresh context creates a new problem:

> The agent does not automatically learn from mistakes made in previous
> features.

That is solved by the Auto Loop.

------------------------------------------------------------------------

# 12. Results File

Every loop execution must produce structured results.

Recommended format:

``` text
results/
    feature-001.md
    feature-002.md
    feature-003.md
```

Each result should record:

``` text
Feature:
Attempt:
Status:
Checks passed:
Checks failed:

What the agent tried:
What failed:
Root cause:
What changed:
What was reverted:
What finally worked:

Recurring mistake:
Potential workflow improvement:
```

The results file is the memory of the execution loop.

------------------------------------------------------------------------

# 13. Basic Build Loop

``` text
START
  │
  ▼
Load project context
  │
  ▼
Load feature specification
  │
  ▼
Write checks
  │
  ▼
Human review
  │
  ├── Reject → revise checks
  │
  ▼
Lock checks
  │
  ▼
Start fresh feature builder
  │
  ▼
Implement feature
  │
  ▼
Run checks
  │
  ├── PASS ───────────────► Feature complete
  │
  └── FAIL
        │
        ▼
    Diagnose failure
        │
        ▼
    Fix implementation
        │
        ▼
    Run checks again
        │
        └──────────────► repeat
```

------------------------------------------------------------------------

# 14. Do Not Trust the Score Alone

A passing score is necessary but not always sufficient.

Example failure:

``` text
Checks:
    Ordering rules pass.

Actual application:
    Order form does not exist.
```

The loop can technically pass its checks while the user-facing workflow
is incomplete.

Therefore verification should include multiple layers.

## Layer 1 --- Unit behavior

Does the individual logic work?

## Layer 2 --- Integration behavior

Does the feature connect to the rest of the system?

## Layer 3 --- User workflow

Can the user actually complete the intended action?

## Layer 4 --- Regression

Did existing functionality remain intact?

## Layer 5 --- Production constraints

Does it respect:

-   Authentication?
-   Authorization?
-   Data persistence?
-   Error handling?
-   Security?
-   Performance constraints?
-   Existing UI conventions?

------------------------------------------------------------------------

# 15. Integration Rule

A feature is not complete merely because its internal checks pass.

The implementation must be connected to the actual application.

Therefore:

> Build the feature and connect it to the application in the same
> implementation cycle.

Check:

``` text
Database
    ↓
Backend
    ↓
API
    ↓
Frontend
    ↓
User workflow
```

A feature that exists only in isolated code is incomplete.

------------------------------------------------------------------------

# 16. Auto Loop

The Auto Loop is the second-order improvement system.

Its job is **not** to build features.

Its job is to improve the method used to build features.

It reads:

``` text
results/
program.md
project context
```

It searches for recurring patterns.

Examples:

``` text
Pattern:
Builder repeatedly passes backend checks
but fails to connect the frontend.

Action:
Add workflow rule:
"Every feature must verify the complete user path."
```

Another example:

``` text
Pattern:
New implementation repeatedly breaks older behavior.

Action:
Add workflow rule:
"Before completing a feature, search all existing
call sites of the changed behavior."
```

------------------------------------------------------------------------

# 17. Habit Detection

The Auto Loop should look for:

-   Repeated implementation mistakes.
-   Repeated missing integration.
-   Repeated regression failures.
-   Repeated incorrect assumptions.
-   Repeated security omissions.
-   Repeated UX omissions.
-   Repeated test gaps.
-   Repeated architecture violations.

Do not create a workflow rule from one random failure unless it reveals
a critical systemic issue.

Prefer:

``` text
Observed repeatedly
        ↓
Identify pattern
        ↓
Find root cause
        ↓
Create durable rule
        ↓
Update workflow
        ↓
Verify future feature
```

------------------------------------------------------------------------

# 18. Program.md

`program.md` contains the operating rules for the loop.

Recommended sections:

``` text
# Objective

# Operating Rules

# Feature Workflow

# Verification Rules

# Security Rules

# Integration Rules

# Regression Rules

# Known Agent Failure Modes

# Lessons Learned

# Stop Conditions
```

Example:

``` text
## Integration Rule

Never mark a feature complete merely because isolated
checks pass.

Verify that the feature is connected to the actual
application workflow.
```

------------------------------------------------------------------------

# 19. What Auto Loop May Modify

Auto Loop may modify:

``` text
program.md
workflow instructions
agent operating rules
lessons learned
```

Auto Loop must NOT modify:

``` text
approved checks
evaluation criteria
historical results
immutable specifications
security constraints
```

This separation prevents reward hacking.

------------------------------------------------------------------------

# 20. Second-Order Learning Loop

The complete system becomes:

``` text
                BUILD LOOP
                    │
                    ▼
              Build Feature
                    │
                    ▼
               Run Checks
                    │
                    ▼
              Store Results
                    │
                    ▼
              AUTO LOOP
                    │
                    ▼
          Detect Recurring Habits
                    │
                    ▼
          Improve program.md
                    │
                    ▼
             Next Feature
                    │
                    ▼
          Better Build Process
                    │
                    └─────────────►
```

The system improves not only the product, but also **how the product is
built**.

------------------------------------------------------------------------

# 21. Recommended Repository Structure

``` text
project/
│
├── program.md
│
├── project-context/
│   ├── architecture.md
│   ├── product.md
│   ├── conventions.md
│   └── constraints.md
│
├── features/
│   ├── features.md
│   └── feature-001.md
│
├── checks/
│   ├── pending/
│   └── approved/
│
├── results/
│   ├── feature-001.md
│   └── feature-002.md
│
├── skills/
│   ├── project-context/
│   ├── build/
│   ├── write-checks/
│   ├── feature-builder/
│   ├── approve-checks/
│   └── auto-loop/
│
├── src/
│
└── tests/
```

------------------------------------------------------------------------

# 22. Feature Lifecycle

Every feature follows:

``` text
IDEA
 ↓
SPECIFICATION
 ↓
CHECKS
 ↓
HUMAN APPROVAL
 ↓
LOCK
 ↓
BUILD
 ↓
TEST
 ↓
FAIL?
 ├── YES → FIX → TEST
 └── NO
       ↓
INTEGRATION VERIFICATION
       ↓
REGRESSION VERIFICATION
       ↓
REPORT
       ↓
AUTO LOOP
       ↓
UPDATE METHOD
       ↓
NEXT FEATURE
```

------------------------------------------------------------------------

# 23. Stop Conditions

The agent must stop when:

-   All approved checks pass.
-   User workflow is verified.
-   Integration is verified.
-   Regression checks pass.
-   No known critical issue remains.

The agent must also stop and request human input when:

-   Requirements are ambiguous.
-   A destructive migration is required.
-   Security implications are unclear.
-   Checks contradict the product requirement.
-   The agent cannot determine the correct behavior.
-   Multiple architectural approaches have materially different
    consequences.

Never let the agent endlessly modify code without meaningful evidence of
progress.

------------------------------------------------------------------------

# 24. Rollback Rules

Every implementation round should be reversible.

Recommended approach:

``` text
attempt-001
    ↓
run checks
    ↓
FAIL
    ↓
revert or isolate changes
    ↓
attempt-002
```

Use Git commits or equivalent checkpoints.

Never overwrite the only known-working state.

------------------------------------------------------------------------

# 25. Token / Cost Control

Loops can consume significant tokens.

Use them selectively.

Before creating a loop, ask:

``` text
Is this repeated?
Can success be measured?
Can the agent run the system?
Will repeated attempts create enough value?
```

If the answer is mostly "no":

> Use a normal agent interaction instead.

Optimize for:

``` text
Value gained from iteration
--------------------------------
Cost of iteration
```

------------------------------------------------------------------------

# 26. Security Boundaries

The agent must not be allowed to modify:

-   Approved checks.
-   Secrets.
-   Production credentials.
-   Security policies.
-   Audit history.
-   Evaluation logic.

For multi-agent execution, prefer isolated environments/sandboxes.

Each agent should have only the access required for its task.

------------------------------------------------------------------------

# 27. Quality Gates

Before declaring a feature complete:

``` text
[ ] Requirement understood
[ ] Checks approved
[ ] Checks locked
[ ] Implementation complete
[ ] Automated checks pass
[ ] User workflow works
[ ] Database persistence verified
[ ] API integration verified
[ ] Frontend integration verified
[ ] Existing behavior verified
[ ] Security constraints verified
[ ] Results recorded
[ ] Repeated mistakes captured
[ ] Workflow updated if necessary
```

------------------------------------------------------------------------

# 28. Core Principles

## Principle 1 --- Verify before trusting

Do not ask the agent whether its work is correct.

Give it objective checks.

## Principle 2 --- Protect the evaluator

The implementation must never control the evaluation criteria.

## Principle 3 --- Build small

One feature at a time.

## Principle 4 --- Fresh context, persistent learning

Use fresh agents for implementation while preserving learning through
project context and workflow rules.

## Principle 5 --- Test the real workflow

Passing isolated tests does not guarantee the application works.

## Principle 6 --- Learn from repetition

One mistake is an incident.

Repeated mistakes are a process problem.

## Principle 7 --- Improve the method

The strongest loop is:

``` text
Build → Test → Learn → Improve Method → Build Better
```

------------------------------------------------------------------------

# 29. Definition of Done

A feature is **DONE** only when:

``` text
Requirement
    +
Approved immutable checks
    +
Implementation
    +
Application integration
    +
Regression verification
    +
Recorded result
    +
Workflow learning
```

All must be satisfied.

------------------------------------------------------------------------

# 30. Final Mental Model

Think of the system as a software factory:

``` text
                 ┌──────────────────┐
                 │  PRODUCT GOAL    │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │   SPECIFICATION  │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │   VERIFICATION   │
                 │  locked checks   │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │     BUILDER      │
                 │ fresh context    │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │      TEST        │
                 └────────┬─────────┘
                          │
                    ┌─────┴─────┐
                    │           │
                   FAIL        PASS
                    │           │
                    ▼           ▼
                  FIX       INTEGRATE
                    │           │
                    └─────┬─────┘
                          ▼
                    ┌───────────┐
                    │  RESULTS  │
                    └─────┬─────┘
                          ▼
                    ┌───────────┐
                    │ AUTO LOOP │
                    │ learn     │
                    └─────┬─────┘
                          ▼
                    ┌───────────┐
                    │ PROGRAM.MD│
                    │ improves  │
                    └─────┬─────┘
                          │
                          └──────► NEXT FEATURE
```

## One-Line Method

> **Define success → lock the evaluator → build with a fresh agent → run
> the real system → record failures → learn recurring patterns → improve
> the workflow → repeat.**

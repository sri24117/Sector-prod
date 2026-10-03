# PROJECT_AI_WORKFLOW.md — which Claude Code skill does what

Short operating guide for the Claude Code skills installed for SEctOr.
Methodology lives in `docs/methodology/METHOD.md`; engineering rules in
`CLAUDE.md`. If this file conflicts with either, they win.

## Installed skills

| Skill | Source | Installed as |
|---|---|---|
| Superpowers 6.4.1 | `obra/superpowers` via Anthropic's `claude-plugins-official` marketplace | user plugin |
| Impeccable 4.5.0 | `pbakaus/impeccable` (author's marketplace) | user plugin |
| VibeSec | `BehiSecc/VibeSec-Skill` (SKILL.md reviewed before install) | `~/.claude/skills/VibeSec-Skill` |
| Find Skills | `vercel-labs/skills` via `npx skills` | `~/.claude/skills/find-skills` |
| Memory | Built-in: `CLAUDE.md` + Claude Code auto-memory (claude-mem: see bottom) | — |

## Who owns what

| Job | Skill | Use for |
|---|---|---|
| **Planning** | `superpowers:brainstorming` → `superpowers:writing-plans` | Turning a feature-spec in `docs/plans/` into a step-by-step plan before any code |
| **Implementation** | `superpowers:executing-plans` / `superpowers:subagent-driven-development`, `superpowers:test-driven-development`, `superpowers:systematic-debugging` | Building one slice/feature at a time; fresh subagent per task (METHOD.md §11) |
| **Verification** | `superpowers:verification-before-completion`, built-in `/code-review` | Proving it works before saying "done" (CLAUDE.md §8) |
| **Memory / context** | `CLAUDE.md`, `PROJECT.md`, `docs/`, Claude Code auto-memory | Durable project knowledge. Superpowers' plans in `docs/plans/` are the per-feature memory |
| **UI / UX** | `impeccable` (`/impeccable shape`, `craft`, `audit`, `critique`, `polish`) | Anything under `apps/web/` |
| **Security (while writing)** | `VibeSec-Skill` | Auth, tenant scoping, SSRF (`apps/api/src/lib/ssrf.ts`), crypto, uploads, redirects |
| **Security (review)** | built-in `/security-review` | Reviewing a finished branch's diff |
| **Finding more skills** | `find-skills` | Only when asked "is there a skill for X?" |

## When NOT to use each

- **Superpowers brainstorming/plans** — not for one-line fixes, doc edits, or
  config changes. Its TDD skill must **never** edit `checks/approved/**`
  (blocked in `.claude/settings.json`); the builder writes code, not the
  evaluator (METHOD.md §8).
- **Superpowers finishing-a-development-branch** — never merge to `main`
  locally; CLAUDE.md §9 requires branch → PR → review.
- **Impeccable** — not for API, worker, crawler, DB, or WordPress PHP code.
  Don't let `bolder`/`overdrive`/`delight` override product decisions; and
  it's not a substitute for testing a real NGO user flow.
- **VibeSec** — not a replacement for the Phase 0 independent review in
  `docs/runbooks/go-live-checklist.md`. It's generic web guidance; where it
  conflicts with `docs/security/security.md` or ADR-0005, those win.
- **Find Skills** — never install a skill without asking the human first
  (enforced: `npx skills add` always prompts). Don't add skills mid-feature.
- **Memory** — never put secrets, NGO PII, FCRA/PAN numbers, or real
  credentials into `CLAUDE.md`, memory files, or plans.

## Overlaps (known, intentional)

- VibeSec vs `/security-review`: VibeSec guides code *as it's written*;
  `/security-review` audits the diff *after*. Use both on auth/tenant/crypto work.
- `superpowers:requesting-code-review` vs `/code-review`: use `/code-review`
  for the review itself; Superpowers' skill only decides *when* to ask for one.
- `superpowers:writing-skills` vs `anthropic-skills:skill-creator`: pick one
  per skill; don't mix.

## Order for a new feature

1. **Spec** — write/confirm `docs/plans/feature-spec-*.md` (template in
   `docs/templates/feature-spec.md`). Product decisions → human.
2. **Plan** — `superpowers:brainstorming`, then `superpowers:writing-plans`.
3. **Checks** — write checks to `checks/pending/`; human approves; move to
   `checks/approved/` (locked) — METHOD.md §6–8.
4. **Branch** — `superpowers:using-git-worktrees` or a feature branch.
5. **Build** — `superpowers:subagent-driven-development` +
   `test-driven-development`; consult **VibeSec** for any auth/tenant/
   external-fetch/crypto code; **Impeccable** (`shape` → `craft`) for UI.
6. **Debug** — `superpowers:systematic-debugging` on any failing check.
7. **Verify** — `superpowers:verification-before-completion`; run the real
   workflow, not just tests (CLAUDE.md §8).
8. **Review** — `/code-review`, `/security-review`, `/impeccable audit` for UI.
9. **PR** — open a PR; human merges. Record results in `results/` (METHOD.md §12).

## claude-mem (not installed — pending decision)

Evaluated `thedotmack/claude-mem`. Not installed yet because it: records every
tool call's input/output (which can include NGO data) and compresses it with
an LLM, using your Claude usage on every action; runs a background worker and
auto-installs Bun + uv/Python; offers optional cloud sync (cmem.ai); and
largely duplicates the built-in `CLAUDE.md` + auto-memory. Revisit only if
cross-session recall actually becomes a problem.

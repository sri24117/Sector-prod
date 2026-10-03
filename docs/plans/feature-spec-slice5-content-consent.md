# Slice 5 — Content generation + consent gate

**Built:** brand kit (`/brand-kit`), `ConsentRecord`s (`/consents`, revocable, evidence note required), content generation (`/content/generate`) via a provider-agnostic `@sector/ai` (`LLM_PROVIDER/ANTHROPIC_API_KEY/LLM_MODEL`; unset => 501), draft -> **human approve** -> export. Web UI `/content`.

**The gate (deterministic code, not an LLM judgment):** an asset naming a beneficiary cannot be exported unless an active (non-revoked), sufficiently-scoped consent exists **in the same org**. Evaluated at export time, so consent revoked after approval still blocks. The refusal returns the missing names, not the content.

**Privacy:** beneficiary names/name-parts are replaced with placeholders before the prompt is built and restored after — the provider never sees them (test-asserted). This caught and fixed a real leak of bare first names.
**Omission can't bypass the gate for story kinds:** `case_study`/`quote` must list beneficiaries or explicitly assert `noBeneficiaryIdentified`.

## Verified
14 API tests: negative cases first — export blocked with no consent; blocked with wrong-scope consent (photo != story); **another org's consent for the same name does not unlock**; blocked after revoke; blocked before approval — then the positive path; cross-tenant 404s; viewer 403; 501 when no LLM configured; pseudonymizer round-trip and word-boundary safety; Anthropic request shape against a stubbed fetch.

## NOT verified / residual risk
1. **No live LLM call was made** (no API key/sandbox egress). Request shape follows the documented Messages API and is unit-tested with a stub; run one real generation before relying on it. **Model/vendor is still a founder decision.**
2. Identifying details typed into free-text facts but not declared as beneficiaries (village, age, employer) can't be detected deterministically. Mitigations: mandatory human approval; facts are user-supplied; prompt forbids inventing people. Residual, disclosed.
3. Brand visuals (Skill 5 rendering/DTCG tokens): only the voice + a free-form `tokens` JSON field are stored; no image generation (Canva/etc. is out of scope per the roadmap).
4. "Export" returns the text; no publishing connectors exist (social platforms are partner-gated, out of Phase 0-1 scope).

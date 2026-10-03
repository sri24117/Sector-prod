# Skill 5: Brand and Visual Designer

> **Reconstruction note**: rebuilt from a detailed working summary after the
> original session's local workspace was reset. If a byte-for-byte original
> copy exists on the founder's side, treat that as canonical.

Status: corrects a Canva-Enterprise-gating assumption inherited from the existing `ngo-marcomm-toolkit`'s visual-collaterals reference, which assumed Canva MCP/Autofill access without checking the plan requirement.

## 1. Role and scope

Graphic design, UI/UX design, illustrations, flyers, posters, and carousels that are brand-aligned: correct typography, type scale, color, and visual rationale for the org's sector and audience.

## 2. The Canva Enterprise gating problem

The Canva Connect API's Autofill/Brand Template features require an **Enterprise plan on both sides**: SEctOr needs Enterprise to call the API programmatically at scale, and **each client NGO would also need its own Enterprise seat** for a fully self-serve brand-template flow. This is a real, non-trivial cost gate on both ends, not a one-time integration task.

## 3. Recommendation: defer Canva, use AI image generation + an internal token model

Given the double-Enterprise gate, the recommended Phase 1 path is AI image generation (candidates: Ideogram, Google's Gemini image model, OpenAI's image models, Stability) combined with an internal DTCG-compatible brand-token store (`BrandKit` — shared with Skill 4), rather than a Canva dependency neither side has budgeted for.

## 4. Figma's role, scoped narrowly

Figma is useful for component-library and design-token sync (keeping SEctOr's own internal design system consistent), not as a generation engine for client-facing NGO visuals. Don't build a Figma-API-driven per-client generation pipeline; that's not what Figma's API is for.

## 5. Explicitly excluded

Midjourney — no official API exists, so it cannot be integrated into an automated pipeline regardless of output quality.

## 6. What ships in v1

**Buildable now, no external gate**: AI-image-generation-based design + the internal `BrandKit` token model and templating. This is what "ships" means for Skill 5 in Phase 1.

**Deferred by deliberate choice, not oversight**: Canva-based generation — a cost/ops decision, not a technical blocker, and one the founder should make explicitly (buy Enterprise for SEctOr and absorb clients into one tenant, or stay on AI-image-gen) rather than the dev team defaulting into either path.

## 7. Data model

`BrandKit` (DTCG-compatible: colors, type scale, logo assets), read by Skill 4 for layout budgets and by this skill for rendering.

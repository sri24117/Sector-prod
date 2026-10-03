# SEctOr Skill Files

Domain intelligence — how SEctOr reasons about each capability. These are
**not** engineering rules (that's `CLAUDE.md`) and not product strategy
(that's `docs/product/product.md`). They describe what SEctOr knows and how
it decides, per domain.

| File | Skill | Status |
|---|---|---|
| `audit-engine.md` | 1. Audit Engine (free, always-on) | Full text — validated against synthetic fixtures |
| `seo-geo-aio-implementor.md` | 2. SEO/AIO/GEO Implementor (the moat) | Reconstructed, see note in file |
| `social-content-calendar.md` | 3. Social Media Content Calendar | Reconstructed, see note in file |
| `content-creator-comms.md` | 4. Content Creator for Communications | Reconstructed, see note in file |
| `brand-visual-designer.md` | 5. Brand and Visual Designer | Reconstructed, see note in file |
| `researcher.md` | 6. Researcher (grants/RFQs/events) | Reconstructed, see note in file |
| `ad-grants.md` | 7. Google Ad Grants Claim and Compliance | Full text |

This is a 7-skill architecture, not the AI Architecture Protocol's own
illustrative 10-file example (`seo.md`, `geo.md`, `aio.md`, `ad-grants.md`,
`content.md`, `social.md`, `campaigns.md`, `brand.md`, `csr.md`, `impact.md`).
That example was a sketch; this list is what was actually researched, scoped,
and reconciled against the founder's requirements. If a `csr.md` or
`impact.md` domain becomes real work later, add it here rather than forcing
it into one of the seven above.

Cross-cutting shared data models used by more than one skill —
`ConsentRecord`, `BrandKit`, `PlatformConnection`, `ResearchMatch`,
`RemediationLog` — are specified once in
`docs/architecture/architecture.md` §11, not duplicated per skill file.

For the full consolidated external-dependency and risk register across all
seven skills, see `docs/integrations/integrations.md` and
`PROJECT.md` §Open Decisions.

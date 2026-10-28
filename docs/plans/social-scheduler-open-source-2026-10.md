# Note: open-source social scheduler (Postiz, Mixpost) — not adopted for the MVP

Date: 2026-10-28. Status: decision logged; ADR-0004 (direct APIs vs Ayrshare) is **unchanged and still unresolved**.

Considered: adopting an open-source scheduler (for example Postiz, AGPL-3.0, or Mixpost Lite, MIT, where Instagram is only in the paid Pro) instead of building social publishing.

Not adopted for the MVP, because:

- It does not remove the need for SEctOr's own Meta app approval (and LinkedIn's); the platform gate is the same either way.
- It adds a service, which needs an ADR (CLAUDE.md §2).
- It would hold OAuth tokens outside the tenant-isolation model (CLAUDE.md §3).
- It would publish without going through the consent check required before any beneficiary content is used (CLAUDE.md §5).
- Licence fit (AGPL network clause; features held back in paid tiers) needs a separate look.

Revisit when ADR-0004 is decided. Social scheduling is promised to customers only "as platform approvals clear".

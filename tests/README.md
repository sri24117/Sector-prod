# tests/

Cross-cutting test conventions and shared fixtures live here (e.g. a
recorded HTML fixture used by more than one package's tests). Package-local
tests live next to the code they test (`services/crawler/test/`,
`apps/api/src/**/*.test.ts`), not here — this folder is for what's genuinely
shared.

See `docs/conventions/conventions.md` §Testing conventions for the test
pyramid and the rule that every PR touching business logic includes a
cross-tenant access test.

Nothing here yet beyond this note — add fixtures as real cross-cutting needs
appear, not preemptively.

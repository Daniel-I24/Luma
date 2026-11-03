# Round 9 — status

The usage limit ran out in the middle of phase 1: this commit saves the work
in progress (WIP), without the full Definition of Done.

| Phase | State |
| --- | --- |
| 1.1 Approving publishes (migration 56, round9.sql, "Tu negocio está aprobado pero aún no se ve" + "Publicar ahora") | Done |
| 1.2 AI 503: retries with backoff, LLM_FALLBACK_MODEL, provider_unavailable, "Reintentar" in the menu scan | Done |
| 1.3 Only "3 negocios por cuenta" visible; internal guard of 10 a day | Done |
| 1.4 scripts/luma.ps1 (7 options), setup-push.ps1 fixed, npm run doctor, tests with simulated services | Done |
| 1.5 GitHub Pages for public/legal (workflow, docs/pages-setup.md, meta-live URLs) | Pending |
| 1.6 docs/release.md with every build variable | Pending |
| Phase 1 full verification (build, lint, all tests, Deno, SQL, check:*) | Pending |
| Phases 2 to 5 and the round closing | Pending |

Migration 56 (`20261106000000_round9.sql`) is pending review, not applied.
Verified in this commit: SQL suites (794 checks, round9.sql reproduces the
bug before the fix), shared LLM Deno tests (18), node script tests, and
the owner-summary and menu-scan specs.

# Round 2 status (phases 4 to 7)

Checked on 2026-10-28 against the commits on `main`.

| Item | State | Evidence |
| --- | --- | --- |
| Logo and icons | Done | `179da53`; `docs/brand/logo.md`, `assets/logo.svg`, `android/app/src/main/res/drawable/ic_luma_*.xml`, `ic_stat_luma.xml`, `ic_splash_mark.xml` |
| Semantic buttons and destructive-action script | Done | `c34aced`; `docs/brand/button-semantics.md`, `scripts/check-destructive-buttons.mjs` (+ test, CI `check:buttons`) |
| Motion | Done | `84f1088`; `docs/brand/motion.md`, `src/styles/motion.css`, `CartFlight`, `LumaCheckmark`, `OrderTimeline` |
| Native splash and animated entry | Done | `d90092e`, `b3940f7`; `MainActivity.java`, `src/index.html` (`#luma-entry`), `core/startup/` (+ spec) |
| Screen review | Partial | `7b1743b`; `docs/brand/screen-review.md`, `scripts/screens/` (offline harness, `check:tokens`). Screens with real data (business profile, order detail, owner, admin) still need a pass on a device |
| SECURITY.md, docs/security.md, threat model, CodeQL | Done | `b0a7cb2`; `SECURITY.md`, `docs/security.md`, `docs/threat-model.md`, `.github/workflows/codeql.yml` |
| Git history scan | Done | `67cf3c6`; `scripts/secret-scan-history.mjs`, `docs/security-findings.md` (project reference in one commit, no keys; history not rewritten) |
| design-preview out of production | Done | `1a1bb82`, `20712b2`; `src/app/dev-routes.ts` replaced by `dev-routes.prod.ts` in production and deploy builds |
| ESLint rules | Done (round 3: most limits now warnings) | `96b9237`, `a17d31c`; `eslint.config.js`, `eslint/` (local rules + tests) |
| Domain classes instead of .util.ts | Done | `96b9237`; no `*.util.ts` left in `src/app`; exceptions in `docs/architecture/patterns.md` |
| Traceability | Done | `ea01ba3`; `docs/requirements-traceability.md` |

## Completed in round 3

- ESLint: errors only for `no-explicit-any`, naming and the 150-line file
  limit; every other quality limit is a warning (no warnings today).
- Screen review: the remaining pass needs real data and a device; it is in
  `docs/launch-checklist.md`.

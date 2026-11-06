# Quality report (round 9 phase 5, finished in round 10)

"Before" is the start of round 9 phase 5 (commit `48e0314`, after the
dependency phase); "after" is round 10 phase B.

| Measure | Before | After | How |
| --- | --- | --- | --- |
| Files (src, supabase/functions) | 839 | 896 | `git ls-files -co --exclude-standard src supabase/functions` |
| Lines | 55,980 | 58,647 | same files, `wc -l` (round 10 added the location picker, recovery, combos, error log) |
| Code files over 150 lines | some | 0 | `scripts/file-length.test.mjs` (app, tests, scripts, functions, styles) |
| Functions over 30 lines (no tests) | 21 | 21 | TypeScript compiler API; most are the `createHandler` closures of the functions |
| Cyclomatic complexity > 10 | warning | lint **error** | ESLint `complexity` |
| Duplicated code (jscpd) | 51 clones, 412 lines | 45 clones, 347 lines (0.90 %) | `.jscpd.json`; CI fails above 0.95 % |
| Unused exports / types (knip) | 40 / 34 | 0 / 0 | `npx knip` |
| TypeScript | strict off for indexes | `strict` + `noUncheckedIndexedAccess` (app, tests, functions) | `tsconfig.json`, each `deno.json` |
| Initial bundle | 673.13 kB | 680.90 kB | `npm run build`; +2.3 kB ErrorLog and the push/realtime hardening, +0.5 kB route credits; the order screen loads MapLibre on idle (`@defer`, proven with `getDeferBlocks`) |
| Unit test coverage | not measured | 84.13 % statements, 78.80 % branches, 76.08 % functions, 87.77 % lines (commit `0500f8b`) | `ng test --coverage`; CI thresholds in `angular.json` |
| Tests | 880 app, 134 scripts, 179 Deno, 794 SQL, 4 e2e | 954 app (233 files, commit `0500f8b`), 149 scripts, 170 Deno, 858 SQL, 6 e2e | the Definition of Done |

## Close of round 11, measured on 2026-11-06

| Check | Result | Commit |
| --- | --- | --- |
| `npm test -- --watch=false --coverage` | 233 files, 954 of 954; 84.13 / 78.80 / 76.08 / 87.77 % | `0500f8b` |
| `npm run test:scripts` | 149 of 149 | `0500f8b` |
| `npm run test:e2e` (axe included) | 6 of 6, after fixing what it found | `4666cc0` |
| `npm run check:responsive` | ok (8 min) | `4666cc0` |
| Build, lint, `tsc` of app and specs | ok; initial 680.90 kB | `4666cc0` |
| SQL suites, final migration 58 (PostgreSQL 18.6) | 47 suites, 858 checks; rehearsal ok, 10 checks | `4666cc0` |
| Deno 2.5.6 in Docker | 14 folders, 170 tests; 13 type checks | `4666cc0` |
| Type check commit by commit (`11da877..0500f8b`, app and specs) | 18 of 18 code commits ok; 7 without code skipped | up to `0500f8b` |
| Secret scan, `npm audit --omit=dev` | ok (1314 files), 0 vulnerabilities | `4666cc0` |
| Debug APK | built on 2026-11-06 08:01:02 -04, 6.96 MB | `4666cc0` |

Not measured again at this close: files, lines, functions over 30 lines, jscpd.
The local SQL harness has no `pg_cron`, so the cron block of migration 58 has
not run anywhere; it repeats the statements of migration 27.
Runtime on a real phone, including the R8 release APK, is still untested.

## 5.1 Code
- One message box (`LumaNotice`, 51 copies), one draft-form helper
  (`DraftForm`), shared OTP verification, one `save` in the owned-business
  repository, the functions share the `at` reader.
- Docs: docs/ARCHITECTURE.md (mermaid system diagram), docs/adr/ (5 ADRs),
  docs/commits.md (Conventional Commits).

## 5.2 Angular
- Every component is standalone with `OnPush`; the app is zoneless (no
  zone.js), signals for state, `@if/@for`, `inject()`, typed forms through
  signals, `takeUntilDestroyed` for the only RxJS subscription.
- `LumaImage` stays a plain image (lazy or eager with high fetch priority,
  async decoding, explicit size). `NgOptimizedImage` was tried and dropped:
  without an image CDN it adds no srcset, and with free-ratio photos under
  `object-cover` it warns on every load (NG02952, NG02960).
- `@defer (on idle)` for the tutorial host and the order's route map.
- Lazy routes for every feature; budgets: initial 750 kB warning / 900 kB
  error, component styles 4 / 8 kB.

## 5.3 Performance
- Explicit columns in every query, pages of 50 at most, 30 s polling only
  while a channel is down and the screen is visible, search sent on demand.
- `supabase/tests/explain_plans.sql`: the customer's orders use
  `orders_user_idx`, the business board `orders_business_idx`, the map's
  bounding box a coordinate index.
- RLS policies of the new tables use `(select auth.uid())` (evaluated once).

## 5.4 Security
- Android: `allowBackup=false`, cleartext off, release WebView debugging off
  (Capacitor default), **R8 on for release** (`minifyEnabled`,
  `shrinkResources`; `LUMA_R8=0` turns it off), `luma://` links parsed
  strictly (`PaymentReturn.parse`).
- Web: CSP and security headers in `vercel.json`.
- Every GitHub Action pinned by SHA; CodeQL; **gitleaks** on the whole
  history; Dependabot grouped (angular, capacitor, testing, lint-and-types,
  actions).
- Edge Functions: JWT, CORS allow-list, input validation, rate limits and
  quotas, idempotent payments, PII-free JSON logs (`EdgeLog`, `PaymentLog`).

## 5.5 Accessibility
- `e2e/walk.e2e.mjs` runs axe-core (WCAG 2.1 A and AA rules) on every walked
  screen, customer and owner, and fails on a serious or critical violation.
  Its first full run found two on the owner panel, both fixed: `role="radio"` on
  the host of `LumaButton` instead of the native button, and an `aria-label` that
  hid the figures of the "today" link.

## 5.6 Observability
- `ErrorLog` (last 20 masked errors, "Copiar errores") and `ErrorReporter`
  (no-op by default; plug a crash reporter here).
- Edge Functions log one JSON line per event with codes and numbers only.

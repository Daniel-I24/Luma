# Optimization report — round 8, phase 4

Cleanup with no change of behaviour: no applied migration, Edge Function
contract (requests, answers, status codes) or user-visible text changed.
"Before" is commit `1a5b5a8` (end of phase 3); "after" is the phase 4
commit. Both measured with the same commands on 2026-11-02.

## Numbers

| Measure | Before | After | Change |
| --- | ---: | ---: | ---: |
| Files in `src/` + `supabase/functions/` | 914 | 822 | −92 (−10.1 %) |
| Lines in `src/` + `supabase/functions/` | 55,571 | 54,830 | −741 (−1.3 %) |
| Lines of `public/i18n/{es,en}.json` | 4,826 | 4,704 | −122 |
| Initial bundle, raw | 670.15 kB | 670.04 kB | −0.11 kB |
| Initial bundle, estimated transfer | 170.90 kB | 170.83 kB | −0.07 kB |
| Clones (jscpd, app code without tests or JSON) | 79 clones, 672 lines | 51 clones, 415 lines | −28 clones, −257 lines |
| Functions over 30 lines | 20 | 20 | 0 |
| knip: unused exports / types | 40 / 34 | 40 / 34 | 0 (exported for tests and the design-system barrel) |
| App tests | 864 | 862 | −2 (design-preview test removed; two `ready` cases joined in one loop) |

Commands: files and lines with `git ls-files -co --exclude-standard src
supabase/functions` (existing files) and `wc -l`; bundle with `npm run
build`; clones with `npx jscpd src/app supabase/functions --ignore
"**/*.spec.ts,**/*.test.ts,**/*.json"`; long functions with the TypeScript
compiler API.

## Goal

- Files: met (−10.1 %, goal 10–15 %).
- Bundle: met (smaller in raw and transfer).
- Lines: **not met** (−1.3 %, goal −10 %). Merging files and moving
  templates inline keeps the lines; the rest of the code is already tight,
  and what is left is tests (17k lines) and the JSDoc that lint requires
  (`luma/require-jsdoc`). Getting 5,500 lines out would mean deleting tests
  or documentation, or reformatting, which change nothing useful. Not done
  on purpose (docs/DECISIONS.md).

## What was merged

- 65 small templates and styles (up to 45 lines of HTML, 40 of CSS) moved
  into their component, keeping each file within 150 lines.
- Build switches: `core/config/{ai-mode,features,support}.ts` →
  `core/config/build-flags.ts`; `PUSH_ENABLED` now lives in
  `core/push/push-platform.ts` and `UPDATE_SITE_URL` in
  `core/update/update-check.service.ts`, their only users.
- Interfaces with a single implementation collapsed into one injectable
  class (tests replace them by provider): `ReportRepository`,
  `AccountProfileRepository`, `PromotionDealRepository`, `AdminRepository`,
  `VerificationRepository`, `PlaceSearchRepository`, `ExternalBrowser`,
  `PushPlatform`.
- `shared/geo/{haversine,distance.pipe}.ts` → `shared/geo/distance.ts`;
  `shared/utils/business-day.ts` and `business-status-rules.ts` →
  `shared/business/domain/opening-hours.ts`; `business-pause.ts` →
  `business.model.ts`; `shared/utils/text-normalizer.ts` →
  `shared/business/utils/search-text.ts`.
- `owner-paths.ts` → `account-paths.ts`; where each account lands
  (`ACCOUNT_HOMES`, error and invite paths) → `account-type.ts`.
- `guest.guard.ts` → `auth.guard.ts`; `sign-out-hooks.ts` +
  `user-data-registry.ts` → `core/auth/session-end.ts`.
- `native-shell.ts` + `native-status-bar.ts` → `core/native/native-device.ts`;
  `external-browser.ts` + `native-haptics.ts` →
  `core/native/native-actions.ts`.
- `near-viewport` + `reveal-selected` directives →
  `shared/ui/viewport.directives.ts`.
- Owner: `publish-requirements.ts` + `re-review.ts` →
  `utils/publication-rules.ts`; `order-pause.repository.ts` +
  `sales-summary.repository.ts` → `services/order-operations.repository.ts`;
  the "load when the route id changes" effect repeated in nine pages →
  `RouteBusinessId.routeBusinessId(load)`.
- Specs: `auth.service.{confirmed,ready}.spec.ts` →
  `auth.service.session.spec.ts`; `app.routes.spec.ts` → `app.spec.ts`.
- Edge Functions: `_shared/supabase-env.ts` (`SupabaseEnv`) replaces the
  environment reading, caller client and service client repeated in eight
  `index.ts`; `secure-compare.ts` moved to `_shared` and used by
  push-dispatch and whatsapp-webhook instead of their own copies;
  `_shared/config/app-links.ts` inlined into create-payment.

## What was deleted

See docs/cleanup-report.md ("Round 8 — phase 4"): the development-only
design preview (feature, `dev-routes*.ts`, its `angular.json`
replacements and its 45 translation keys in each language).

## Lesson (bundle)

esbuild keeps a module whole in one chunk. Merging a module used only by
lazy screens into one the first screen loads moves it into the initial
bundle (the first try grew it by 1.4 kB: haptics, the lazy build flags,
the owner paths and the search normaliser). Merges now group code by the
chunk that loads it. Tailwind reads every source file (docs included)
for class names: a CSS comment moved into a `.ts` file named a plain
utility and added an unused class (+0.26 kB), so the comment was reworded.

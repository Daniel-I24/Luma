# Cleanup report

What the Definition of Done cleanup (CLAUDE.md) found and removed at the end
of each phase. Tools: `npx knip` (config in `knip.json`) and `npx depcheck`.
Nothing is removed without proof that it is unused (no references, every
check green).

## Round 2, phase 0 (2026-10-24)

Removed: nothing.

Findings kept, with the reason:

| Finding | Tool | Why it stays |
| --- | --- | --- |
| `@fontsource-variable/inter` unused | knip, depcheck | imported from `src/styles.css` (CSS, not seen by the tools); replaced in phase 4 |
| `prettier` unused | knip, depcheck | CLI tool named in `.kiro/steering/tech.md` |
| `@angular/build`, `@angular/compiler-cli`, `tslib`, `postcss`, `tailwindcss`, `@tailwindcss/postcss` unused | depcheck | used by the Angular builder and the PostCSS pipeline, not imported |
| `@capacitor/android` unused | depcheck | native platform package loaded by the Capacitor CLI |
| `@std/assert`, `@core/*`, `@shared/*` missing | depcheck | Deno import map (`deno.json`) and TypeScript path aliases |
| 69 unused exports, 94 unused exported types | knip | mostly constants and types exported for specs; cleaned when phase 6 turns `.util.ts` files into classes (docs/DECISIONS.md) |

## Round 2, phase 1 (2026-10-24)

Removed: nothing. knip reports no unused files or dependencies; the unused
exports list is unchanged in kind (phase 6). No migration of round 1 was
touched; redefinitions live in new files.

## Round 2, phase 2 (2026-10-24)

Removed: nothing. Hard-coded provider URLs moved into named constants
(`_shared/config/provider-urls.ts`, `core/config/external-urls.ts`); no
file became unused.

## Round 2, phase 3 (2026-10-26)

Removed: the translation keys `auth.signup.personal.phoneHintOwner` and
`phoneHintCustomer` (the mobile is required for every account now; no
reference left). The app-side `Money` draft was not added (docs/DECISIONS.md).
knip: no unused files or dependencies.

## Round 2, phase 4 (2026-10-26)

Removed: the old splash PNGs and launcher template layers (vector icons
replace them), the `pulse`, `spring`, `bounce` and `fade-in-up` motion
tokens and the `pulse-ring` keyframes (no reference left), the Inter font
package. knip: no unused files or dependencies.

## Round 2, phase 5 (2026-10-26)

Removed: nothing. The design preview is no longer bundled in production
(dev-routes.ts replaced), the code stays for development.

## Round 2, phase 6 (2026-10-27)

- Renamed every `*.util.ts` (and its spec) when its functions became
  classes: e.g. `pickup-slots.util.ts` → `pickup-slots.ts`,
  `sheet-drag.util.ts` → `sheet-drag-math.ts`, `combo.util.ts` →
  `combo-builder.ts`, `normalize-text.util.ts` → `text-normalizer.ts`.
- `export` removed from 45 symbols used only inside their own file
  (knip "unused exports"); deleted as unused: the constant `HOURS_PER_DAY`
  and the class `BusinessCategories` (`categoryLabelKey`, no caller). The
  `*_STATUSES` and `ACCOUNT_TYPES` lists stay exported: their types derive
  from them.
- `LumaToastHost` removed from the design-system barrel (imported by path
  so it stays out of the barrel's eager graph).
- Kept on purpose: the design-system barrel's type re-exports (its public
  API) and the Edge Function exports (Deno modules, outside this pass).

## Round 4 (2026-10-28)

- Nothing deleted: knip reports no unused files or dependencies; the
  remaining unused exports are the ones kept on purpose (Edge Function
  module exports and types used by specs). The new `CheckoutLink` type
  stays private to `payment.repository.ts`.

## Round 5 (2026-10-28)

Deleted (no references left; build, lint, tests and checks green):

- `AccountProfileRepository.setOnboardingSeen`, `SessionProfileStore.markOnboardingSeen`
  and `AccountProfile.onboardingSeenVersion`: the welcome is per device now.
- `OrderDetailView.directionsUrl`, the order screen's `directions()` and its
  test: replaced by RouteMap (which keeps the Google Maps link).
- Translation keys no longer used: `onboarding.saveFailed`,
  `orders.detail.directions`, `businessPanel.menu.sortOrder`,
  `businessPanel.menu.sortOrderHint`, `businessPanel.menu.drag`,
  `owner.summary.title`, `owner.verificationPage.upload`.
- The "Orden" number field of the product form.

Moved, not deleted: `features/onboarding/onboarding-slides.ts` and the
welcome template to `shared/tutorial/`, `features/profile/components/appearance-settings`
to `shared/appearance/` (shared with "Mi negocio"); the delete sheet of
`AccountActions` to `DeleteAccountSheet`.

knip: no unused files or dependencies; the new exports that nothing used
were made private. depcheck: only the known false positives (path aliases,
tooling read through config files).

## Round 6 (2026-10-29)

- Nothing deleted. The website code path `/luma-verificacion.txt` (round 5,
  only in texts and the admin link) is now `/.well-known/luma-verification.txt`
  through `ContactVerifiers.fileUrl`.

## Round 7 (2026-10-31)

- `src/app/shared/business/domain/nit.ts` (and its spec) moved to
  `src/app/core/validation/nit.ts`: the NIT rule belongs with the other
  rules (all imports updated).
- Removed, replaced by core/validation: the phone pattern and the 5-90 %
  discount constants of `business-write.schemas.ts`, the website, Instagram
  and Facebook patterns of `business-contact.ts`, the name length checks of
  the sign-up, Mis datos and the legal form.
- Removed 25 translation keys no code uses any more (old per-form messages:
  `auth.signup.validation.fullName|phone|phoneRequired`,
  `accountDetails.errors.name|phone`, `businessPanel.validation.name|phone|
  address|description|itemName|price|section|promoTitle|discount|date|
  datesOrder|endsInPast|contact.*`, `reviews.validation.commentTooLong`,
  `reports.validation.comment`, `profile.validation.displayNameTooLong`,
  `owner.menuScan.priceNeeded`), checked with git grep before removing.
- `route.walk` and `route.drive` replaced by `route.modes.*`.

## Round 8 — phase 1 (2026-11-02)

- Removed the "Enviar notificación de prueba" button and its code from
  NotificationSettings (moved to the admin `DeviceTest`).
- Removed the key `owner.menuScan.aiUnavailable` (replaced by
  `owner.menuScan.errors.*`).

## Round 8 — phase 2 (2026-11-02)

- Deleted `src/app/shared/tutorial/tutorial-settings.ts` and
  `src/app/features/profile/components/help-links/` (replaced by
  `HelpEntries` and the Tutoriales screen); their keys
  `profile.help.tutorial|terms|privacy|refunds|allTutorials` and
  `owner.myBusiness.help` were removed after checking nothing used them.
- `scripts/screens/capture.mjs` shares its static server
  (`scripts/screens/server.mjs`) with `check-responsive`.

## Round 8 — phase 4 (2026-11-02)

Every item was checked with git grep (no import, route, script or doc
left pointing at it) and the full Definition of Done stayed green.

- Deleted the development-only design preview: `src/app/features/design-preview/`
  (page and its two preview components), `src/app/dev-routes.ts`,
  `src/app/dev-routes.prod.ts`, their two `fileReplacements` in
  `angular.json`, the route test in `app.routes.spec.ts` and the 45
  `designPreview.*` keys of `es.json` and `en.json`. It never shipped in
  production (docs/DECISIONS.md, round 8 phase 4).
- Deleted files whose content moved into another file of the same
  responsibility (list in docs/optimization-report.md): 65 component
  templates and styles, `core/config/{ai-mode,features,support,push-enabled,update-check-url}.ts`,
  `core/auth/{guest.guard,sign-out-hooks,user-data-registry}.ts`,
  `core/native/{native-shell,native-status-bar,external-browser,native-haptics}.ts`,
  `shared/geo/{haversine,distance.pipe}.ts`, `shared/utils/{business-day,text-normalizer}.ts`,
  `shared/business/models/business-pause.ts`,
  `shared/business/utils/business-status-rules.ts`,
  `shared/account/{owner-paths,account-homes}.ts`,
  `shared/ui/{near-viewport,reveal-selected}.directive.ts`,
  `features/owner/utils/{publish-requirements,re-review}.ts`,
  `features/owner/services/{order-pause,sales-summary}.repository.ts`,
  `core/auth/auth.service.{confirmed,ready}.spec.ts`, `app.routes.spec.ts`,
  `supabase/functions/_shared/config/app-links.ts` and the per-function
  `secure-compare.ts` copy.
- Deleted the abstract classes with a single implementation (eight; the
  implementation kept the abstract class's name).

## Round 9 — phase 1 (2026-11-03)

- Removed the keys `businessPanel.dashboard.publish` (replaced by
  `owner.publish.publishNow`) and `owner.menuScan.errors.providerBusy`
  (split into `providerQuota` and `providerSaturated`); git grep found no
  other use.
- `scripts/setup-push.ps1` lost its own copy of the push steps: it calls
  option 2 of `scripts/luma.ps1` (`scripts/luma/push.ps1`).

## Round 9 — phase 2 (2026-11-03)

- Removed the polling constants `ORDER_REFRESH_MS`, `BOARD_REFRESH_MS`,
  `NOTIFICATIONS_REFRESH_MS`, `UNREAD_REFRESH_MS` and `ORDER_ALERT_POLL_MS`
  and their `PollWhileVisible` calls: Realtime replaces them (its fallback
  polls only while the channel is down). `PollWhileVisible` stays (checkout
  clock, FreshnessNote).

## Round 9 — phase 3 (2026-11-03)

- `supabase-access-token.txt` is no longer written or read: the doctor uses
  the CLI session, and the optional token stays in memory (owner's request).
  Delete that file from `%USERPROFILE%\luma-secrets` if an earlier run
  created it, and revoke the token.
- `PaymentReturn.webReturnGuard` moved to `payment-return.routes.ts` (lazy).

## Round 10 — phase A (2026-11-04)

- `src/app/features/auth/signup/common-passwords.ts` and `password-strength.ts`:
  replaced by `core/validation/password-rules.ts` (with 200 common passwords)
  and `shared/account/password-checklist`, used by the three password forms.
- `AuthRules.newPassword` and `recoverPasswordSchema`: the recovery checks
  the code first (`verifyRecoveryCode`) and saves later
  (`setRecoveredPassword`); new passwords use `PasswordRules`.
- `src/app/features/owner/components/address-search/`: replaced by
  `location-picker/location-search.ts` (bounded to the municipality).
- Keys `owner.wizard.addressSearch|addressPlaceholder|search|farFromAddress`,
  `businessPanel.location.hint|mapLabel|useCurrent|useCentre|chosen|denied`
  and `auth.signup.validation.passwordCommon`: no references left.

## Round 11 (2026-11-05)

Measured with `npx knip`, `npx depcheck` and a search of every translation key.

- `docs/ROUND8-STATUS.md`, `ROUND9-STATUS.md`, `ROUND10-STATUS.md`, `round2-status.md`:
  moved to docs/WORKLOG.md ("Status of the rounds"); the two references updated.
- docs/WORKLOG.md section "Left": described round 1 work already done; replaced.
- `src/app/features/orders/orders-pages.spec.ts`: split into `orders.page.spec.ts` and
  `order-detail.page.spec.ts` (the same cases; the 150-line limit), with `orders.harness.ts`.
- `src/app/features/profile/components/admin-entry/`: moved to shared (used by two features).
- Key `feed.title`: no reference in code, tests or a dynamic prefix. 26 other candidates are
  built from constants (`V`, `E`) and stay.
- `export` of `parseOsrm` (only used in its own file).
- Kept although flagged: `axe-core` (knip; `e2e/support/axe.mjs` loads it by path), and what
  depcheck lists (`@capacitor/android`, Tailwind and PostCSS, `tslib`, the build tools; its
  "missing" packages are path aliases and Deno imports).

## Round 12 (2026-11-06)

Measured with `npx knip`, `npx depcheck`, a search of every translation key, CSS
variable and global class, and a search of every public class member.

- `TextNormalizer.isClean`, `SessionProfile.profileComplete` (and `MIN_FULL_NAME`),
  `VerificationStore.serverMissing`: no reference in templates, code or tests.
- `.luma-marker--picked`, `.doodles--color`, `--opacity-doodle-color`,
  `public/media/doodles/color.svg`: only referenced by the rule that used them.
- `--container-preview`, `--size-preview-tile`, `--size-preview-card` (the preview
  page no longer exists), `--color-accent-hover`: no utility or `var()` reads them.
- Translation keys and dependencies: nothing to delete. Kept although flagged:
  `axe-core` (knip), and depcheck's list, as in round 11.

## Round 13: two themes

Asked for by the owner, with what stopped being used:

- `src/styles/themes/night.css`, `lacquer.css`, `maize.css`, their swatch tokens and translations:
  replaced by `crema.css`; a saved preference migrates (`ThemeService`).
- `.doodles--on-brand`, `--color-doodle-on-brand`: the gradient left the screens that used them.
- `MyOrderItem` is no longer exported (knip): it is used only in its own file.

## Round 14: review before the presentation (2026-11-07)

| Removed | Proof it was unused | Replacement |
| --- | --- | --- |
| `src/app/features/auth/auth-page.css` | Imported only by the four auth pages; no test or e2e selects its classes | Tailwind utilities with the same tokens in the four templates (screens compared: only a 2-3 px shift from the typography line heights) |

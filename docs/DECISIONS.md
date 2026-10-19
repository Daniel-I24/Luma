# Decisions

Choices made while the owner was away. Each one: what, why, and the
alternative that was not taken. The safest, most reversible option wins.

## 2026-10-18 — CI: isolate the Vitest spec files

- **What**: `angular.json` → `test.options.isolate: true`.
- **Why**: the Angular unit-test builder defaults to `isolate: false`, so spec
  files in the same worker share one module registry. A spec that loaded the
  real `maplibre-gl` first made `vi.mock('maplibre-gl')` useless in later
  specs; it only showed on machines with fewer cores (GitHub runners).
  Reproduced on Linux (Docker, one core): 2 of 3 full runs failed before, 30
  runs alone and 10 full runs green after.
- **Alternative**: mock `maplibre-gl` in every spec that touches the map, or
  disable code splitting. Fragile: the next spec without the mock breaks it
  again. Cost of isolation: slower suite (about 75 s instead of 45 s locally).

## 2026-10-18 — delete-account: recent sign-in window of 10 minutes

- **What**: 403 `reauth_required` when `last_sign_in_at` is older than 10
  minutes, unreadable or missing.
- **Why**: deleting is irreversible; a refreshed token proves nothing about
  who holds the phone. `last_sign_in_at` changes only on password or code
  sign-in.
- **Alternative**: ask for the password again inside the delete sheet. Better
  UX, but sends the password to a second place; can be added later on top.

## 2026-10-18 — Stepped sign-up keeps its draft in memory

- **What**: `SignupDraftStore` is root-provided and never persisted.
- **Why**: the draft must survive opening `/legal/terms` and coming back, but
  the password must never reach `localStorage` or `sessionStorage`. A reload
  loses the draft; that is acceptable for a four-step form.
- **Alternative**: open the legal pages in a new tab or a sheet. New tabs
  behave badly inside the Android WebView.

## 2026-10-18 — One consent flag for terms, privacy and legal age

- **What**: three separate checkboxes in the app, but `handle_new_user` keeps
  reading the single `accepted_terms` flag; the app sends `true` only when
  all three are checked.
- **Why**: the account-types migration (not applied) already records
  `consented_at` and `terms_version` from that flag; no SQL change needed.
- **Alternative**: three columns. More precise evidence, but a migration for
  data the app already enforces; revisit with the legal review.

## 2026-10-18 — Tutorial is a page, shown on landing

- **What**: `/welcome`, reached through `accountHomeGuard` (and the login,
  code and recovery screens) when `onboarding_seen_version` is older than
  `ONBOARDING_VERSION`. "Omitir" and "Empezar" both record it; a failed save
  shows a notice and still lets the user in.
- **Why**: a route is testable, reachable again from the Profile, and never
  traps the user.
- **Alternative**: an overlay on the home screen. Harder to make accessible
  (focus trap, back button) for no gain.

## 2026-10-18 — Luma Negocios lives in `features/owner`, one business per URL

- **What**: the business panel folder moved to `features/owner`; every tab
  is under `/owner/:businessId/...` and the old `/business/**` routes were
  removed. The selected business is only remembered in memory (wiped on
  sign-out).
- **Why**: a business id in the URL makes every screen linkable (owner
  notifications open `/owner/:id/orders`) and the switcher trivial; not
  persisting the selection means a shared device never shows the previous
  owner's business.
- **Alternative**: keep `/business` and add a global "current business".
  Hidden state, harder to test.

## 2026-10-18 — "Total vendido" counts picked-up orders of the Bogota day

- **What**: today's figures use orders created today in America/Bogota;
  the total sums only `picked_up` orders.
- **Why**: the same day boundary as `create_order`, and money is only
  "sold" once the customer picks the order up (payment is at pick-up).
- **Alternative**: count accepted orders too. Overstates sales when orders
  are cancelled later.

## 2026-10-18 — Sign-out and account deletion are one shared component

- **What**: `shared/account/account-actions` (sign out, delete sheet) is used
  by the Profile and by "Mi negocio".
- **Why**: features cannot import each other; one copy of the deletion flow.

## 2026-10-18 — Luma IA: rules by default, remote behind a constant

- **What**: `AI_MODE` (`src/app/core/config/ai-mode.ts`) is `'rules'`; with
  `'remote'` the app calls the Edge Functions and falls back to the rules.
- **Why**: nothing is deployed and `environment.ts` cannot be touched; a
  typed constant keeps the default safe and the switch one line.
- **Alternative**: a field in `environment.ts` (forbidden to edit) or a
  runtime flag in the database (more moving parts for a one-time switch).

## 2026-10-18 — The promotion rules exist twice (function and app)

- **What**: the rules advisor lives in
  `supabase/functions/suggest-promotions/ideas.ts` (below 10 orders) and in
  `src/app/shared/promotions/advisor/rules-promotion-ideas.ts` (rules mode).
- **Why**: Deno functions and the Angular app cannot share source files;
  both copies are small, documented as mirrors and tested with the same
  scenarios.
- **Alternative**: a SQL function used by both. One copy, but harder to
  test and to evolve than a pure function.

## 2026-10-18 — Gemini and OpenAI-compatible JSON without schema fields

- **What**: Gemini uses `responseMimeType: application/json` and
  OpenAI-compatible providers `response_format: json_object`; the JSON Schema
  travels in the instructions and every answer is validated strictly.
  Anthropic uses `output_config.format`.
- **Why**: the schema fields differ between providers and models (and
  OpenAI-compatible hosts vary); JSON mode plus strict validation works on
  all of them.
- **Alternative**: provider-specific schema fields. Tighter output, but more
  breakage when providers change.

## 2026-10-18 — APK: JDK chosen by version, icon tool run on demand

- **What**: `scripts/apk.mjs` accepts only JDK 17-24 (Gradle 8.14); an
  invalid or too-new `JAVA_HOME` falls back to Android Studio's JBR or
  another installed JDK. `@capacitor/assets` is run with `npx` once and is
  not a dependency.
- **Why**: this machine's Android Studio bundles JDK 25, which Gradle 8.14
  cannot run (assembleDebug passed with Temurin 21). `@capacitor/assets`
  brings `sharp`/`tar` versions with high and critical advisories.
- **Alternative**: upgrading Gradle and the Android Gradle Plugin to run on
  JDK 25 (larger change, to do with the next Capacitor upgrade).

## 2026-10-18 — No CSP meta in the APK yet

- **What**: evaluated, not added (docs/android.md).
- **Why**: `connect-src` depends on the environment's Supabase URL and the
  tile hosts; the APK only loads bundled files over https and blocks
  cleartext.
- **Alternative**: generate the meta at build time with `generate-env.mjs`.

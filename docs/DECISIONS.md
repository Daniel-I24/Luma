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

## 2026-10-19 — Email confirmation checked inside the database

- **What**: `is_email_confirmed()` (account_types) is required by every
  write RPC; reviews and reports use a trigger so the error is the specific
  `email_not_confirmed` instead of a generic RLS failure.
- **Why**: the client can skip the login screen; the database is the
  authority.
- **Alternative**: only enforce it in Supabase Auth settings ("confirm
  email"), which the app cannot verify and the owner may switch off.

## 2026-10-19 — Storage file cap via a definer count

- **What**: `business_image_count(name)` (SECURITY DEFINER) counts files in
  the business folder; the insert policy requires fewer than 80.
- **Why**: a policy on `storage.objects` reading `storage.objects` recurses.
- **Alternative**: a trigger on `storage.objects`, which Supabase manages and
  may not allow.

## 2026-10-19 — Geocoding on submit only, provider by secret

- **What**: the app calls `geocode` when the user submits the search; the
  provider (photon, nominatim, locationiq, maptiler) is chosen by secrets and
  missing secrets answer `geocode_unavailable` (businesses-only search).
- **Why**: respects the strictest policy (Nominatim forbids autocomplete),
  keeps the free quotas, and no key ever reaches the client.
- **Alternative**: search-as-you-type with a paid provider; possible later by
  changing only the app's trigger.

## 2026-10-19 — AI quota spent only on model calls

- **What**: recommend, suggest-promotions, extract-menu and geocode consume
  quota after the cache check, right before the provider call; suggest-
  promotions answers the rules (200) when the model is missing or fails.
- **Why**: cached and rule answers cost nothing; users should not lose quota
  for them.
- **Alternative**: count every request (simpler, but punishes cache hits).

## 2026-10-19 — Push: at-most-once, secret-poked, Spanish texts

- **What**: push-dispatch is poked by the database (pg_net, pg_cron
  fallback) with a shared secret, claims each notification once and sends
  Spanish texts built on the server; promotions are opt-in.
- **Why**: no service role key stored in the database; no duplicate pushes;
  the in-app list (translated) stays the source of truth; marketing consent
  is explicit.
- **Alternative**: Supabase database webhooks with the service role key, or
  retries with attempts (in docs/db-followups.md).

## 2026-10-19 — Push: Android only, behind PUSH_ENABLED, permission on demand

- **What**: @capacitor/push-notifications 8.1.3 (official plugin, same major
  as Capacitor, published 2026-10-02; npm audit clean); `PUSH_ENABLED`
  false until google-services.json exists; permission asked only when the
  user turns a notification on; the token is removed before sign-out.
- **Why**: registering without Firebase crashes the APK; asking at start-up
  gets denied; shared phones must not receive the previous user's notices.
- **Alternative**: web push with the Firebase SDK and a service worker
  (bigger bundle, VAPID keys); left for later.

## 2026-10-19 — Version check without touching the environment files

- **What**: `public/version.json` ({latest, minimum}) checked at start-up;
  the web reads its own origin, the APK reads `UPDATE_SITE_URL` (null by
  default, so the APK skips the check until it is set).
- **Why**: the APK serves its own copy of version.json from https://localhost;
  environment.ts may not be edited, and a wrong URL must never block the app.
- **Alternative**: an `apiUrl`/`siteUrl` field generated in environment.deploy.ts.

## 2026-10-24 — Round 2: claim_push_batch is dropped and created again

- **What**: `20261029000000_push_business_id.sql` drops `claim_push_batch(integer)`
  and creates it with the extra `business_id` column, re-granting only
  `service_role`.
- **Why**: Postgres cannot change the columns a function returns with
  `create or replace`. The arguments and grants stay the same, the
  migration runs in one transaction and only push-dispatch calls it.
- **Alternative**: a second function `claim_push_batch_v2`. Leaves a dead
  function with service-role access behind.

## 2026-10-24 — One rate-limit RPC with buckets in app_settings

- **What**: `hit_rate_limit(bucket)` counts the caller's requests in fixed
  windows; a bucket exists only when `rate_<bucket>_max` and
  `rate_<bucket>_window_seconds` exist. extract-menu calls it before
  decoding any image.
- **Why**: the daily quotas count model calls (so cache hits are free) and
  do not stop a burst of large requests that fail later. One generic,
  closed function is reused by later functions (payments) without a new
  table each time. Callers can only spend their own bucket.
- **Alternative**: a per-function counter table, or counting in memory in
  the Edge Function (lost on every cold start and per instance).

## 2026-10-24 — knip config in the repository, export cleanup in phase 6

- **What**: `knip.json` (entries for Angular specs, scripts and Deno
  functions) is versioned; knip and depcheck run with `npx` only. The
  unused exports knip lists (mostly constants exported for their specs and
  types of `.util.ts` files) are cleaned when phase 6 turns those files
  into classes.
- **Why**: without a config knip reports the generated Android assets and
  every CSS file. Removing exports now would be redone by the phase 6
  restructuring.
- **Alternative**: knip as a devDependency with a CI job (one more
  dependency to audit), or removing the exports twice.

## 2026-10-24 — create_order and set_order_status change their arguments

- **What**: the 4-argument `create_order` and the 2-argument
  `set_order_status` are dropped and created again with one more argument
  (`p_payment_method`, `p_reason`), both with defaults, in the same
  migration, with the same grants.
- **Why**: the prompt asks for those arguments; Postgres treats a new
  argument as a new overload, and two overloads with defaults make every
  old call ambiguous. The defaults keep old calls working.
- **Alternative**: new function names (`create_order_v2`). Leaves the old,
  weaker function callable by every client.

## 2026-10-24 — Wompi: what the documentation does and does not say

- **What**: the integrity signature follows the documented order and is
  pinned by the documented vector (`37c8...3bf5`, reproduced). The event
  checksum follows the documented algorithm (property values in order,
  timestamp, events secret, SHA-256), but the example checksum on the events
  page cannot be reproduced from its own inputs (no order or HMAC variant
  matches), so the tests use vectors computed from the documented steps and
  compare hex case-insensitively. Transactions are confirmed with
  `GET /v1/transactions/{id}` and the private key (the docs say public-key
  reads now answer 404). No search by reference is documented, so
  reconciliation needs the transaction id from the redirect.
- **Why**: implement only what docs.wompi.co states; do not trust an
  unverifiable example.
- **Alternative**: query by reference (undocumented, may break silently).

## 2026-10-24 — Refunds are manual; voids only for cards

- **What**: `void-payment` voids card transactions through the API; every
  other method stays in "Reembolsos pendientes" until the admin refunds it in
  the Wompi dashboard and marks it done.
- **Why**: the docs say voids apply to cards only and document the refunds
  API for the sandbox only.
- **Alternative**: call `POST /v1/refunds` in production on the strength of
  the sandbox page.

## 2026-10-24 — A payment approved after its order expired is refunded

- **What**: unpaid online orders are cancelled after 15 minutes; a late
  approval turns the attempt into `refund_required` instead of reviving the
  order.
- **Why**: the business may be closed or out of stock by then, and the
  customer was already told the order was cancelled.
- **Alternative**: revive the order. Surprising for both sides.

## 2026-10-24 — Review flags: nearby businesses only of other owners

- **What**: `near_duplicate_location` counts businesses of **another** owner
  within 50 m.
- **Why**: one owner with two places in the same food court is normal; a
  stranger registering a place where one already exists is the fraud signal.
- **Alternative**: any business within 50 m (noisy for multi-branch owners).

## 2026-10-24 — SQL test helpers default to aal2

- **What**: `tests.become` puts `aal = aal2` in the claims unless a suite
  calls `tests.use_aal('aal1')`; the stub gains `auth.jwt()`.
- **Why**: the existing admin suites keep testing what they were written
  for; the MFA rule has its own checks with aal1 and aal2 in every admin
  suite of round 2.
- **Alternative**: rewrite every admin check of round 1.

## 2026-10-24 — Residence is saved after the email code, not in the sign-up metadata

- **What**: `handle_new_user` keeps copying only name, phone and consents;
  the app writes the residence (column grants) once the account is
  confirmed. An account without it gets `profile_incomplete` when ordering
  and the app asks for it.
- **Why**: every value copied from metadata needs validation inside a
  trigger that must never fail; the residence has real constraints.
- **Alternative**: copy it in `handle_new_user` too.

## 2026-10-24 — One avatar object per user, the app deletes the old one first

- **What**: the Storage policy allows an upload only when the user's avatar
  folder is empty.
- **Why**: Supabase does not allow deleting Storage objects from SQL, so a
  replace-in-place cannot be enforced in the database; one object is.
- **Alternative**: allow two objects for the swap (a stale photo could stay).

## 2026-10-26 — @capacitor/browser 8.0.5 for the Wompi checkout

- **What**: new dependency `@capacitor/browser` 8.0.5 (official Capacitor
  plugin, same major as `@capacitor/core`, published 2026-10-02, exact
  version, `npm audit --omit=dev` clean). `ExternalBrowser` opens only links
  that start with Wompi's checkout URL.
- **Why**: the prompt requires the hosted checkout by redirection; opening it
  in the system browser (Custom Tab) keeps the payment page out of the
  app's WebView, so no Luma script can ever read it.
- **Alternative**: an in-app WebView or `window.open` (the checkout would run
  inside the app's process), or Wompi's widget script (forbidden).

## 2026-10-26 — No Money class in the app

- **What**: `Money` (integer cents) lives in the Edge Functions
  (`_shared/payments/money.ts`), where amounts are signed and compared. The
  app never computes, sends or compares an amount: it shows
  `orders.total_cop` with the COP pipe.
- **Why**: an unused value object in the app would be dead code; the rule
  "every amount comes from the server" makes it unnecessary.
- **Alternative**: a mirrored app class used only for display.

## 2026-10-26 — The business wizard is a hub over the existing screens

- **What**: `/owner/:id/setup` lists the steps (basics, location, hours,
  contact, legal data and documents, menu) with their state, computed from
  what the server-side draft still lacks (`missingForReview`), and opens the
  existing edit screens with `?setup=1`, where "Volver al asistente" appears.
  The final review sends the business with `submit_business_for_review`.
- **Why**: the draft is the business row itself, so the wizard resumes on any
  device without a second copy of the data; every form keeps one
  implementation and its tests.
- **Alternative**: a separate multi-step form with its own local draft
  (duplicated forms and validation, a draft that lives on one phone only).

## 2026-10-26 — The mobile is required for every account

- **What**: the sign-up asks every account (customers too) for a +57 mobile,
  and explains why ("verificar la cuenta y evitar pedidos falsos").
- **Why**: `is_profile_complete()` needs it before ordering (round 2 anti-fraud
  rules); asking at sign-up avoids a surprise at checkout.
- **Alternative**: keep it optional and ask at the first order ("Mis datos"
  still covers accounts created before round 2).

## 2026-10-26 — Place search moved to shared/geo

- **What**: `PlaceSearchRepository` lives in `shared/geo` and is used by the
  map search and by the owner's address search.
- **Why**: features may not import each other (CLAUDE.md).
- **Alternative**: a second repository in the owner feature (duplicate code).

## 2026-10-26 — Icons as Android vectors instead of @capacitor/assets bitmaps

- **What**: the adaptive launcher icon, the themed (monochrome) icon, the
  notification icon and the Android 12+ splash icon are vector drawables
  built from the same path as `assets/logo.svg`; only the legacy launcher
  PNGs (Android 7) are rendered, with a local Pillow script from the same
  geometry. The old splash bitmaps and template layers were removed.
- **Why**: vectors stay sharp at every density and keep one source of truth.
  Running `npx @capacitor/assets` (an unpinned external package) was refused
  by the session's permission rules, and it is not needed for vectors.
- **Alternative**: `npx @capacitor/assets generate --android` once the owner
  allows it; it would produce PNGs for every density from `assets/`.

## 2026-10-26 — Brand identity changed in the steering files

- **What**: `.kiro/steering/design-tokens.md` and `conventions.md` and
  `CLAUDE.md` name the new colours, fonts and themes.
- **Why**: round 2 asked for a new visual identity on the same token
  architecture; leaving the old names would mislead the next session.
- **Alternative**: keep the steering text and only document the change in
  `docs/brand/` (two sources that disagree).

## 2026-10-26 — App entry ends when the first screen is ready, capped at 1.8 s / 0.9 s

- **What**: the native splash stays until `index.html` has loaded (at most
  1.5 s), the page paints the same mark (`#luma-entry`) and `AppEntry`
  plays it until the session is restored and the first navigation settles,
  at most 1.8 s the first time and 0.9 s afterwards; a tap skips it. Its
  colours follow the system light/dark mode, like the native splash, not
  the app theme. It runs on the web too (there it is the loading screen).
- **Why**: "nunca retrasa más de lo que tarda en estar lista la sesión"
  read literally: the entry never holds a ready app, so on fast devices the
  choreography is cut short by a fade. Matching the native colours avoids a
  jump at the hand-over.
- **Alternative**: always play the full 0.9–1.8 s (a fixed delay on every
  start), or colour the entry with the user's theme (a visible colour jump
  from the native splash).

## 2026-10-26 — playwright-core (dev) for the screen review

- **What**: `playwright-core@1.63.0` (exact, no dependencies, released
  2026-09-04) drives the system Edge to capture the screens
  (`scripts/screens/capture.mjs`) from a `screens` build that uses
  `environment.screens.ts` (an invented `.invalid` host) and fixtures; all
  other requests are aborted. Not part of CI or the app bundle.
- **Why**: the review at 360/412/768 px in four themes needs real renders;
  `playwright-core` downloads no browsers and touches no real backend.
  `npm audit --omit=dev` is unchanged (0).
- **Alternative**: the full `playwright` package (downloads browsers), or a
  manual review on a device only.

## 2026-10-26 — Session storage stays in the WebView (SecureSessionStorage evaluated, not adopted)

- **What**: the Supabase session keeps using the client's default storage
  (WebView `localStorage`). An encrypted store backed by the Android
  Keystore (a `storage` adapter for `createClient` over a secure-storage
  plugin) was evaluated and not added.
- **Why**: on Android the WebView storage is in the app's private
  directory; `allowBackup="false"` keeps it out of backups and other apps
  cannot read it without root, where a Keystore-backed store would not
  stop an attacker either (the running app decrypts it). The change would
  add a third-party native plugin, make session reads asynchronous at
  start, need a migration of existing sessions and bring Keystore failure
  modes (keys invalidated after a lock-screen change sign everyone out).
  The access token lives one hour; refresh tokens rotate and are revoked
  on sign-out.
- **Alternative**: `SecureSessionStorage` implementing Supabase's
  `SupportedStorage` over `@aparajita/capacitor-secure-storage` (or the
  official plugin if Capacitor ships one), plugged in `SupabaseService`
  only on native platforms; revisit if the app starts storing anything
  more sensitive than the session, or before an iOS release.

## 2026-10-28 — ESLint: errors only for any, naming and 150 lines

- **What**: complexity, function length, depth, params, magic numbers,
  accessibility, return types, prefer-readonly, layer boundaries, loose
  functions and JSDoc are warnings; `no-explicit-any`, naming and
  `max-lines` (150) stay errors.
- **Why**: round 3 asked for warning mode; the code has zero warnings today
  and the Definition of Done forbids new ones, so nothing is lost.
- **Alternative**: keep every rule as an error (stricter, but a single
  long function would block CI).

## 2026-10-28 — Phone verification flag outside the environment files

- **What**: the app flag is `PHONE_VERIFICATION_ENABLED` (InjectionToken,
  `false`) in `src/app/core/config/features.ts`, not
  `environment.features.phoneVerification`.
- **Why**: round 3 forbids reading or touching `src/environments/`; a
  token keeps the default off, is replaceable in tests and needs no
  environment change.
- **Alternative**: a `features` block in every environment file (requires
  editing the forbidden files).

## 2026-10-28 — Migration 50 keeps phone changes behind the verification flow

- **What**: `20261031000000_phone_verification` adds the phone check to
  `submit_business_for_review` (same signature and grants), the trigger
  `profiles_phone_guard` and `sync_verified_phone()`. SQL without a user
  (dashboard, service role) is not restricted.
- **Why**: with the requirement on, a user could otherwise verify one
  number and then type another; with it off nothing changes.
- **Alternative**: a separate `verified_phone` column (more migration
  work, two sources of truth).

## 2026-10-28 — Round 4: one migration, the order before the payment

- **What**: `20261101000000_round4_hardening` (migration 51) replaces, with
  the same signatures, return types and grants, `prepare_payment`,
  `apply_payment_event`, `mark_refund_required`, `payments_to_reconcile`,
  `admin_request_void`, `admin_mark_refund_done`, `tax_id_taken`,
  `review_business` and the view `business_order_items`; adds
  `private.flag_payment_refund`; widens `notifications_status_valid`.
  No DROP was needed (no return type changed).
- **Why**: migrations 1 to 50 are applied and frozen; one reviewable file.
  Locking the order first everywhere removes the deadlock between a late
  approval (payment then order before) and a cancellation (order then
  payment).
- **Alternative**: one migration per point (more files to review and apply).

## 2026-10-28 — A duplicate charge leaves the order as it was

- **What**: the second approved attempt of a paid order becomes
  `refund_required` with `duplicate_charge` for the customer; the order
  keeps `payment_status = 'approved'`, also after the duplicate is voided
  or refunded. `admin_mark_refund_done` marks the order `refunded` only
  when no payment of it is left approved or to refund.
- **Why**: the order was paid once; overwriting its payment status would
  hide that and could cancel the pickup.
- **Alternative**: a separate `duplicate` payment status (one more state
  in the shared 49-vector state machine).

## 2026-10-28 — No reconciliation by reference, no minimum amount

- **What**: `reconcile-payments` skips attempts without a transaction id;
  no `payments_min_total_cop` was added.
- **Why**: docs.wompi.co (read 2026-10-28) documents neither a search of
  transactions by reference nor a minimum amount; using an undocumented
  endpoint or inventing a minimum is not reversible in production. Both
  are questions in docs/payments-checklist.md for the sandbox run.
- **Alternative**: `GET /v1/transactions?reference=` (undocumented).

## 2026-10-28 — rls_auto_enable() revoked only when the role may

- **What**: the migration revokes EXECUTE on `rls_auto_enable()` inside a
  block that turns `insufficient_privilege` into a notice; the function
  is in the commented allow-list of `supabase/tests/function_privileges.sql`.
- **Why**: Supabase creates it in hosted projects (owned by another role)
  and it does not exist in the local harness; a hard REVOKE could make
  `db push` fail.
- **Alternative**: ask Supabase support to change its grants.

## 2026-10-28 — NIT: pending duplicates are a flag, approved ones block

- **What**: `tax_id_taken` (submit and approval) only blocks against an
  approved business of another owner; a pending one with the same NIT is
  shown as `duplicate_tax_id` in the review flags.
- **Why**: a pending squatter could otherwise block the real owner from
  even submitting; the admin decides with the flag in view.
- **Alternative**: block on pending too (the round 2 rule).

## 2026-10-28 — Deno lint in warning mode, no camelcase rule

- **What**: `supabase/functions/deno.lint.json` (recommended rules plus
  no-explicit-any, eqeqeq, no-eval, no-throw-literal, prefer-const), run
  by CI with `continue-on-error` and by `npm run lint:functions` (also
  the 150-line limit, exit 0 unless `--strict`).
- **Why**: same limits as the app without a mass refactor; `camelcase`
  flags the snake_case keys of the database and Wompi payloads (46 hits),
  which the app's naming rule also allows for object properties.
- **Alternative**: errors from day one (would block CI on style).

## 2026-10-28 — verify-backend: protected is not missing

- **What**: RPCs are called with placeholder arguments for their required
  parameters (checked against the migrations by the test); 401/403/42501
  is "protected", PGRST202 with those arguments "missing". Private buckets
  pass on "not found" or "forbidden"; Edge Functions split "not deployed"
  (fails only for `--expect-deployed`) from "deployed but failing" (5xx).
- **Why**: against the real project the old checks reported protected RPCs
  with required arguments and private buckets as missing.
- **Alternative**: a service-role check (would need a secret on the PC).

## 2026-10-28 — Round 5: one migration (52) and its choices

- **What**: everything of round 5 that touches the database is in
  `20261102000000_round5.sql`, not applied. Same signatures and grants for
  `create_order`; new objects revoked from anon.
- **Why**: the brief asks for one reviewable migration.

## 2026-10-28 — A1: the owner list is filtered twice and keyed by user

- **What**: `listMine` filters `owner_id = me` and drops any row of another
  owner; every panel write also adds `owner_id = me`; `OwnerContextStore`
  remembers whose list it holds and reloads for another account.
- **Why**: the code already filtered, so the 5-business list could not be
  reproduced without the real project. The most likely cause is a list kept
  in memory when another account signed in without a SIGNED_OUT event; the
  extra filter costs nothing. Recorded as not reproduced.

## 2026-10-28 — A2/A3: the real causes found in code

- **What**: `SessionProfileStore.whenLoaded()` returned at once right after
  sign-in because `_loaded` still described "nobody": the guard saw no
  account type and sent the user to "no puedes ingresar". It now tracks
  whose profile is loaded, ignores stale reads and retries a failed read
  twice (400 ms, 1.2 s). The welcome screen's buttons stayed disabled when
  the navigation after "Omitir" threw (no `finally`). Every native plugin is
  also guarded with `isPluginAvailable`, and `AppErrorHandler` prints the
  real error in development only.
- **Why**: the web failure itself could not be reproduced without the real
  keys (src/environments may not be read); these were the paths that fit
  both symptoms.

## 2026-10-28 — B1: welcome per device, guides without a library

- **What**: the welcome shows once per device (`luma.welcome.v1`), not per
  account; the profile column `onboarding_seen_version` stays in the
  database but the app no longer reads or writes it. Section guides are
  our own (`GuidedTour`, `TourRegistry`, `GuidedTourOverlay`) without
  @angular/cdk.
- **Why**: adding the CDK (a new dependency) only for one positioned
  overlay is more surface than ~120 lines of our own code; the overlay
  measures the real control with `getBoundingClientRect`.
- **Alternative**: CDK Overlay, if more overlays appear.

## 2026-10-28 — A5: drafts on the device, wiped at sign-out

- **What**: `FormDraftStore` keeps drafts per user and form for 14 days and
  wipes them at sign-out and account deletion; the leave warning uses the
  browser's own confirm.
- **Why**: a shared phone must not keep someone's drafts; keeping them
  across a deliberate sign-out is less safe than losing them.

## 2026-10-28 — B4: "Agotado" hides the product

- **What**: inline "Disponible / Agotado" toggles `is_available`; customers
  do not see sold-out products (RLS), so "ocultar" and "agotado" are the
  same state. The "Orden" field is gone; order changes with up/down and
  drag (pointer events; keyboard and screen readers use up/down).
- **Why**: a separate hidden flag needs RLS, `order_line_prices` and
  `create_order` changes; not worth the risk in this round.

## 2026-10-28 — B5: contact verification without cost

- **What**: `contact_verifications` + `<kind>_verified_at` (no column grant
  for owners, a trigger clears them when the value changes). Phones and
  WhatsApp are checked in the support chat (`SUPPORT_WHATSAPP`, an
  injection token, empty until configured); social profiles and websites by
  the code published there. Customers see only verified contacts (app
  level: the columns stay readable through the API as before).
- **Why**: no SMS or paid API; the values were already public.

## 2026-10-28 — B7: correction requested = "changes requested"

- **What**: `request_legal_correction` moves an approved business to
  `rejected` with the note `owner_correction` (shown translated), not to
  `pending`.
- **Why**: `pending` keeps the legal data locked (`owns_editable_business`)
  and could be approved before the owner corrects anything; "changes
  requested" hides the business, unlocks the data and needs a new submit.

## 2026-10-28 — B8: OpenRouteService behind RoutingProvider

- **What**: the `route` Edge Function uses OpenRouteService Directions V2
  (HeiGIT docs, checked 2026-10-28: 2000 directions a day and 40 a minute by
  default; the key must stay on the server). Without `ROUTE_API_KEY`, or
  when it fails or the user's 60 a day are used, it answers a straight line
  with distance and estimated time.
- **Why**: free plan with a documented server-side key; the plans page
  itself did not load, so the owner must confirm the plan and its terms
  (commercial use) in the HeiGIT dashboard before enabling it.

## 2026-10-28 — C2: Lucide copied as path data

- **What**: every icon is Lucide 0.468.0 path data in the registry (ISC
  licence in docs/brand/icons.md), no npm package; `luma-ai` stays ours.
- **Why**: only ~40 icons are used; a package would add tooling for nothing.

## 2026-10-29 — Round 6: automatic contact verification, off by default

- **What**: migration 53 (`20261103000000_round6.sql`) adds
  `contact_verifier_config()`; `contact_auto_whatsapp` and
  `contact_auto_website` start at 0. Phone and WhatsApp use
  `WhatsAppInboundVerifier`, the website `WebsiteFileVerifier`, Instagram and
  Facebook always `ManualAdminVerifier`. With a flag off, an unknown answer
  or no secrets, that kind falls back to the admin queue (the queue still
  lists every pending request, so the team can always finish one by hand).
- **Why**: nothing changes until the owner configures Meta and turns it on.

## 2026-10-29 — whatsapp-webhook keeps no number

- **What**: only the message id (7 days) and an HMAC of the sender keyed with
  the App Secret (attempt limit, 10 a day) are stored; the number is passed
  to the database only to compare it with the request and is never saved;
  the text is never logged. The function never answers messages. It returns
  200 after the signature check and processes in `EdgeRuntime.waitUntil`
  when available; a bad signature is 401.
- **Why**: Meta retries non-200 answers for up to 7 days (duplicates are
  expected, hence the idempotency by id).
- **Alternative**: a separate salt secret; the App Secret already is one and
  never leaves the server.

## 2026-10-29 — Website file moves to /.well-known

- **What**: the website code lives at `/.well-known/luma-verification.txt`
  (manual and automatic), one line exactly equal to the code. verify-website
  allows https on 443 only, resolves A and AAAA and refuses private,
  loopback, link-local, CGNAT, metadata and reserved addresses, again after
  each of at most 2 same-host redirections; 5 s, 4 KB, no user headers.
- **Why**: a standard place; the residual DNS rebinding risk is documented in
  docs/whatsapp-setup.md.

## 2026-10-29 — Landlines are explained, not verified

- **What**: numbers starting with 60 (Colombian landlines) under the
  WhatsApp strategy show an explanation and no request button nor badge.
- **Why**: they cannot send a WhatsApp from the number itself.

## 2026-10-29 — Owner diagnostics in memory only

- **What**: `PanelQueryLog` keeps the last 30 reads of the panel (table,
  filter with ids cut to 8 characters, row count) in memory, wiped at
  sign-out; "Información técnica" shows the masked e-mail and short user id.
- **Why**: enough to see if the business list arrives with another owner's
  rows or with the wrong filter, without personal data or a server log.

## 2026-10-31 — Round 7: travel modes with a moto that borrows the car

- **What**: "Cómo llegar" offers a pie, bicicleta, moto and carro as icon
  buttons (aria-label and tooltip; the chosen one shows its name). ORS
  profiles foot-walking, cycling-regular and driving-car; the moto uses
  driving-car with 0.8 of its time and says "Tiempo aproximado". Without a
  key: straight line at 4.8, 15, 30 and 25 km/h (docs/route.md). The last mode
  is remembered on the device (`luma.route.mode`). Lucide 0.468 has no
  motorcycle: `moto` is Luma's own drawing on the same grid and stroke.
- **Why**: ORS has no motorcycle profile; the car route is the closest and the
  label keeps the estimate honest. A deployed `route` function from before
  answers 400 to the new modes and the app falls back to its straight line.

## 2026-10-31 — Business limit: the trigger already counted every state

- **What**: `businesses_owner_limits` (migration of round 2) already counted
  all the owner's businesses under a per-owner advisory lock; migration 54
  keeps that and adds a daily limit of creations (`hit_rate_limit
  'business_create'`, 3 a day, `rate_business_create_*`), so deleting and
  creating again does not get around it. Owners above 3 keep their businesses
  and cannot add more. The app keeps 3 as a constant (`MAX_OWNED_BUSINESSES`);
  the database value is the authority.
- **Why**: the safest change is the smallest one; concurrency is covered by
  the lock (the SQL suite checks the lock is taken; the harness has a single
  session, so two real simultaneous inserts are not run).

## 2026-10-31 — /owner checks the account on every child route

- **What**: `ownerChildGuard` (canActivateChild) runs the same check as
  `ownerGuard` on every move inside /owner; a customer goes to
  `/profile?invite=business`, where the "Registra tu negocio" sheet opens.
- **Why**: Angular does not run a parent's canActivate between its children,
  so a customer who signed in on a device left inside the panel could move
  to another business URL (reproduced by `owner-guard.spec.ts`). RLS already
  kept other owners' unpublished data out; the guard keeps the panel out.

## 2026-10-31 — Validation rules shared by app and database

- **What**: `core/validation` (Specification pattern) holds every rule; the
  same rules are SQL functions in `private` with CHECK constraints NOT VALID
  (docs/validation-matrix.md, docs/data-quality.sql). Shared vectors run in
  both test suites. The rule functions are SECURITY DEFINER only so that they
  can call each other without giving clients USAGE on `private`; they read no
  table. Letters use `collate "und-x-icu"` (under "C" Postgres sees only ASCII
  letters).
- **Choices**: the business-name list is `& ' - . , ( )` (the ";" of the
  prompt read as punctuation). Invisible characters (zero-width, direction
  marks, controls) are removed when saving, not refused: the user cannot see
  them. Discounts go 1-90 % (was 5-90). Business names 60 (was 80) and
  addresses 120 (was 200) for new and edited rows. The legal representative
  follows the person-name rule with 120 characters. A display name needs 2
  characters. Order notes are cleaned by the server (they come through
  create_order). The same phone saved in the +57 form keeps its verification.
- **Why**: one rule, two enforcers; NOT VALID so old rows never block the
  migration; reversible by dropping the constraints.

## 2026-10-31 — Review of migrations 52 and 53, fixed in 54

- **What**: owners read `contact_verifications` without `verified_by`
  (column grant); the daily request limit (3) counts per kind and business
  and a new request voids the pending ones of its kind; verify-website reads
  IPv6 as 16 bytes and refuses everything outside 2000::/3 plus any embedded
  private IPv4 (::ffff:0:0/96, ::/96, 64:ff9b::/96, 2002::/16), documentation
  and Teredo; without `Deno.resolveDns` (or when it is not supported) it asks
  Cloudflare's DNS over HTTPS (JSON, A and AAAA, 3 s); a website must be typed
  with https:// (the app no longer completes it). verify-backend treats 52 and
  53 as applied.

## 2026-11-02 — Round 8, phase 1: build flags instead of constants

- **What**: `AI_MODE`, `PUSH_ENABLED` and `SUPPORT_WHATSAPP` were tokens
  whose factory returned a constant (`'rules'`, `false`, `''`) and nothing
  in the build set them: every APK ran Luma IA in rules mode, never
  registered for push and had no support WhatsApp. They now come from the
  build environment through `ng build --define`
  (`scripts/build-flags.mjs`, used by `build:prod` and the APK);
  `LEGAL_CONTACT_EMAIL` the same way. src/environments is untouched.
- **Why**: one place, validated (a bad value fails the build), testable.
  Push turns on by itself when `google-services.json` is in the build (the
  only way it can work) and `PUSH_ENABLED=0` turns it off.

## 2026-11-02 — Login: e-mail in lower case, codes before messages

- **What**: the e-mail is trimmed and lower-cased before Supabase
  (`emailSchema`); e-mail and password fields have autocapitalize,
  autocorrect and spellcheck off; the password is sent exactly as typed,
  with "ver/ocultar". Supabase errors map by `code` first
  (invalid_credentials and user_not_found give the same message), then by
  message; no answer is a network message.
- **Why**: a phone keyboard capitalizes the first letter; "Ana@…" did not
  match the account.

## 2026-11-02 — Prices as "$20.000"

- **What**: `CopFormat` removes the space Intl puts after "$".
- **Why**: requested format; it also never wraps inside a card.

## 2026-11-02 — The test notification is an admin tool

- **What**: migration 55 makes `send_test_notification` admins only (aal2);
  "Probar mi dispositivo" lives in /admin → Operaciones. `scripts/setup-push.ps1`
  does the local part of docs/push-setup.md without printing secrets.

## 2026-11-02 — Businesses in review, when the team allows it

- **What**: `app_settings.show_pending_businesses` (0). With 1, a published
  business in 'pending' (it passed submit_business_for_review) is public with
  "En verificación", pick-up payment only (`orders_online_needs_approval`
  trigger; the app hides "Pagar en línea"). A draft never shows; rejected and
  suspended disappear. Every public read goes through `is_business_public`.
- **Why**: the safest default is off; turning it on is one update.

## 2026-11-02 — Public legal pages from the app texts

- **What**: `scripts/build-legal.mjs` writes public/legal/*.html from
  `public/i18n/es.json` (order from legal-documents.ts, versions from
  legal-version.ts) and CI checks they match; a new "Eliminación de datos"
  document; the contact e-mail is `{{email}}` (LEGAL_CONTACT_EMAIL). Short
  URLs in vercel.json before the SPA fallback.
- **Why**: Meta and the stores need public URLs; one source avoids two texts.

## 2026-11-02 — Round 8, phase 2: fluid layout checked by a browser

- **What**: type tokens in rem with clamp() (never below their phone size)
  so Android's font size scales them; fluid base rules (overflow-wrap,
  media max-width, balanced headings); container queries where a row
  adapts to its own width. `npm run check:responsive` drives the screens
  build (fixtures, no backend) at 8 sizes and with 200 % text and fails on
  side scroll, text cut sideways or targets under 44 px. It uses the
  existing dev dependency `playwright-core` (no new package): the system
  Edge locally, Chromium installed in CI (`playwright-core install`).
- **Found and fixed**: the owner menu row image took the whole row (name 0
  px wide, price outside the card) because `LumaImage`'s host is
  `display: contents` and its size classes were ignored — the image is now
  sized by a wrapper (also the owner hero and the gallery); tab labels cut
  with large text (they wrap and stop growing at what five tabs fit);
  32 px chips, links and the "Añadir" icon under 44 px.
- **Why**: real renders at real sizes are the only reliable check.

## 2026-11-02 — Verification in three steps; help in two entries

- **What**: Resumen shows "Verifica tu negocio, paso N de 3" with a
  progress bar; each step (data, hours and menu, legal data and documents)
  is one tappable row with why it matters and "Completar"; privacy note,
  time, pending/rejected/approved states; a disabled "Enviar a revisión"
  says which steps are missing. "Ayuda y legal" has two entries in the
  Profile and Mi negocio: "Tutoriales" (/tutorials, /owner/:id/tutorials:
  welcome, guides with a seen mark, "Repetir", "Reiniciar todas") and
  "Legal" (tabs Términos, Privacidad, Reembolsos; each tab keeps its
  /legal/<doc> address, so deep links work).

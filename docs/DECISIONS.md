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

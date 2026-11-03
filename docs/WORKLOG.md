# Worklog — fase roles, verificación y APK

Plan: [docs/roadmap/fase-roles-y-apk.md](roadmap/fase-roles-y-apk.md). This file
says what is done, half done and left, updated with every commit so any
session can resume.

How to verify: `npm run build`, `npx ng lint`, `npm test -- --watch=false`,
`npm run test:scripts`, `npm audit --omit=dev --audit-level=high`, and the SQL
suites with `supabase/tests/local/run.sh` (local Postgres on port 54329 in the
agent's sessions).

## Round 2 (from 2026-10-24)

Prompt: round 2 (phases 0 to 7). Migrations 5 to 28 are applied by the
owner and never edited; new migrations only, later than 20261028000000.
Local checks in the agent's sessions: Postgres 18 on port 54329 for the
SQL suites, Deno 2.5.6 in Docker for the functions.

- FASE 0 done (2026-10-24): Definition of Done in CLAUDE.md; push-dispatch
  isolates each send, sets the Android channel (orders / promotions),
  deletes a token only when FCM blames it, sends business_id (migration
  29), the app creates the channels and routes taps (PushRoute);
  extract-menu checks shape, session, ownership and the new per-user rate
  limit (migration 31, hit_rate_limit) before decoding images;
  review_business microsecond tests (SQL and app); migration 30
  (notify_promotion cap 500, handle_new_user without casts, devices need a
  confirmed email); deploy.md lists each function with its JWT flag.
  Closed green: build (initial 638.66 kB), lint, 673 app tests, 58 script
  tests, 434 SQL checks, 92 Deno tests + type check, check:interactive,
  secret scan, npm audit --omit=dev 0. check:hardcoded-urls comes in
  phase 5. Cleanup: docs/cleanup-report.md (nothing removed).

- FASE 1 done (2026-10-24): 17 new migrations (32-48 in docs/migrations.md):
  admin MFA (aal2) and append-only audit log; customer residence, complete
  profile, optional phone check, private avatars (business sees them only
  while serving, with consent); cancel reasons, no-show strikes and trust
  tiers; online payments (immutable attempts, append-only events, shared
  state machine vectors, prepare/apply/refund/admin tools); order pause;
  the single final create_order (5 arguments, every protection, one test
  per protection); review invitations; NIT reuse refused, review warning
  signs, daily sales. SQL helpers: aal claim (aal2 default), complete
  profile; stubs: auth.jwt(), phone columns, extensions schema. 620 SQL
  checks, rehearsal 10 checks. Known gap until phase 3: the owner app must
  send a reason when cancelling after accepting (reason_required), and
  admins need the TOTP screen (is_admin needs aal2).

- FASE 2 done (2026-10-24): _shared/payments (Money, PaymentStateMachine
  with the shared vectors, IntegritySignature with the documented vector,
  CheckoutUrlBuilder, MerchantCredentials Strategy/Factory, WompiApi
  adapter, WompiEventParser + EventChecksum, PaymentEventVerifier chain,
  PaymentApplier, Reconciler, SupabasePaymentRepository, typed PaymentLog);
  functions create-payment, wompi-webhook (verify_jwt false), reconcile-
  payments (verify_jwt false, cron secret or admin aal2), void-payment;
  migration 49 (payment_event_seen, payment_attempt, admin_note_reconcile,
  private.payments_cron + conditional cron); provider URLs in
  _shared/config/provider-urls.ts, app URLs in core/config/external-urls.ts,
  npm run check:hardcoded-urls (in CI); push texts for payment and
  review_invite. Closed green: build, lint, 673 app tests, 61 script tests,
  630 SQL checks, 123 Deno tests + type check of 10 functions, interactive,
  hard-coded URLs, secret scan, npm audit 0. Cleanup: nothing to remove.
  Incident: one grep for URLs matched src/environments/environment.ts and
  printed its Supabase URL line (project reference, not a key); every scan
  now excludes src/environments.

- FASE 3 done (2026-10-26): owner cancel reasons and "No llegó" (15 min
  after ready), "Pagado en línea"; admin TOTP (/admin/mfa, admin_access)
  and /admin/operations (payment issues, void/refund mark, reconcile,
  strikes, audit) plus review warning signs; "Mis datos" (/account/details)
  with the DANE catalog (public/data/dane-municipalities.json built by
  scripts/dane-catalog.mjs, ResidenceCatalog lazy, ResidencePicker), avatar
  settings (private, consent, share switch; owner card shows it signed);
  six-step sign-up (mobile required, residence, optional photo with
  consent, saved after the code by SignupCompletion); online payments in
  the app (PaymentGatewayFactory: PayAtPickupGateway, WompiGateway with
  @capacitor/browser 8.0.5, sandbox banner, OrderPayment with retries and
  resume refresh, luma://payments/return, "Completar pago", refunds policy
  draft); "Tu estado" trust card; S1 "Pedir de nuevo", S2 review invite and
  readable payment notices, S3 order pause (owner card, cart "Pedidos en
  pausa"), S4 sales summary chart; package com.lumapasto.app; LocationIQ
  recommended with its credit and a 48 h cache; map starts at the
  residence; checkout warns about another department; business wizard
  /owner/:id/setup with address search and pin-distance warning.
  Closed green: build, lint, app tests, 64 script tests, 630 SQL checks,
  124 Deno tests + type check, interactive, hard-coded URLs, secret scan,
  npm audit 0. knip: no unused files or dependencies.

- FASE 4 done (2026-10-26): palette "Cielo andino y ají" in four AA
  themes (sky/night/lacquer/maize, check:contrast 33 pairs each), Bricolage
  Grotesque + Figtree self-hosted; pin-luna mark, wordmark, vector launcher,
  themed, notification and Android 12 splash icons, Luma IA icon
  (docs/brand/logo.md); buttons by function with loading state and
  check:buttons (docs/brand/button-semantics.md); motion tokens with one
  enter and one exit curve, fling-speed sheets, cart flight, advancing order
  line, drawn check, logo view transition (docs/brand/motion.md); app entry
  continuing the native splash (MainActivity holds it until the page loads,
  AppEntry capped 1.8 s / 0.9 s, ends when session and first navigation are
  ready, tap skips); screen review at 360/412/768 px in four themes with an
  offline Playwright harness and check:tokens (docs/brand/screen-review.md).
  Closed green: build, lint, 735 app tests, 74 script tests, 630 SQL
  checks, Deno unchanged (124), interactive, hard-coded URLs, buttons,
  contrast, tokens, secret scan, npm audit --omit=dev 0. knip: no unused
  files or dependencies (82 unused exports left for FASE 6). Dev-only audit
  advisories (fast-uri, undici, uuid via @capacitor/cli) noted for FASE 5.

- FASE 5 done (2026-10-26): history scan (npm run scan:history, report
  only) found the Supabase CLI link data committed once on 2026-10-17
  (project reference, no keys) and two false positives; reported in
  docs/security-findings.md, history not rewritten; supabase/.temp is a
  forbidden path; tree clean. Design preview no longer bundled in
  production (dev-routes.ts replaced). SECURITY.md, docs/security.md,
  docs/threat-model.md (STRIDE, 16 threats with controls and tests),
  docs/payments-checklist.md, CodeQL workflow (JS/TS, Java, Actions,
  security-extended). SecureSessionStorage evaluated and not adopted
  (DECISIONS). npm audit fix for dev deps; vite advisory accepted (dev
  server only). .env files ignored. Closed green: build, lint, 735 app
  tests, 76 script tests, all checks, secret scan, audit 0; SQL and Deno
  unchanged in this phase. Magic numbers go to FASE 6 (lint rule).

- FASE 6 done (2026-10-27): ESLint in CI now enforces naming,
  complexity 10, 40 lines per function, 150 per file, depth 3, 4 params,
  no magic numbers (0, 1, -1), explicit accessibility and return types,
  prefer-readonly, no any, plus local rules (eslint/plugin.js, tested):
  layer boundaries, no exported free functions, JSDoc on classes and
  public methods. 115 free functions became static class members (AST
  codemod), every .util.ts renamed, complex functions split, numbers named
  (core/config/units.ts, http-status.ts, schema limits; data tables carry a
  justified disable), 740 accessibility modifiers, 235 JSDoc blocks.
  docs/architecture/patterns.md, a README in each of the 23 features,
  conventions updated. Performance: budgets already in angular.json,
  every component OnPush, maps in lazy chunks and removed on exit, images
  lazy. Cleanup recorded in docs/cleanup-report.md. Closed green: build
  (650 kB initial), lint, 735 app tests, 79 script tests, all checks,
  secret scan, audit 0, knip without unused files or dependencies; SQL and
  Deno unchanged in this phase. Edge Functions are outside the new ESLint
  rules (Deno lint is a follow-up).

- FASE 7 done (2026-10-27): docs/requirements-traceability.md maps the 16
  required capabilities to code and tests; two gaps fixed
  (SignupCompletion and the sign-up photo step had no tests). Final DoD
  green: build (650 kB initial), lint, 740 app tests, 79 script tests,
  630 SQL checks, 124 Deno tests and type check of 10 functions,
  interactive, hard-coded URLs, buttons, contrast, tokens, secret scan,
  npm audit --omit=dev 0, knip without unused files or dependencies.
  Round 2 closed.

## Round 4 (2026-10-28)

- Migration 51 `20261101000000_round4_hardening` (1 to 50 applied, not
  touched): attempt_in_progress (180 s, seconds left in the hint),
  duplicate charge -> refund_required via private.flag_payment_refund
  (duplicate_charge / refund_pending_admin), order locked before payment,
  reconcile list with pending attempts without id, void only for refunds,
  payments closed to service_role, business_order_items without unpaid
  orders, NIT blocks only against approved businesses of another owner
  (also in review_business), set_updated_at / rls_auto_enable not RPCs.
  SQL suites payments_round4, review_tax_id, function_privileges; updated
  payments_flow and business_signals.
- Edge Functions: create-payment answers retry_after_seconds; reconciler
  skips attempts without id (Wompi documents no search by reference);
  push texts (duplicate charge, admin refund, "El negocio ya recibió tu
  pedido"); Deno lint in warning mode (deno.lint.json, CI, lint:functions).
- App: "Reintentar pago" disabled with its cause and a countdown;
  'infinity' pauses; notification texts and admin link; tax_id_in_use
  messages for owner and admin.
- verify-backend: placeholder arguments, protected vs missing, private
  buckets, --expect-deployed, failing vs not deployed, migration 50
  required. docs/payments-checklist.md (sandbox questions, GitHub Pages
  plan B), docs/payments.md, migrations, launch checklist, threat model
  T18-T20, traceability R20-R21, DECISIONS.
- DoD: build, lint, 751 app tests, 89 script tests, 674 SQL checks, 125
  Deno tests, type check and lint of the functions, every check, secret
  scan, audit 0, knip (no unused files or dependencies).

## Round 5 (2026-10-28)

- Block A: owner list filtered and re-checked by owner_id, keyed by user,
  "N de 3 negocios" and a disabled "Añadir" with its reason; native plugins
  behind isPluginAvailable, dev-only console error, welcome buttons never
  stuck; the sign-in race of SessionProfileStore fixed plus two silent
  retries; delete account with consequences, e-mail code (signInWithOtp /
  verifyOtp) and one message per failure; FormDraftStore drafts and the
  leave warning on promotion, product, business data, legal data and
  registration; own_business in create_order (protections test extended);
  the trust-limit message depends on payments and links to the order.
- Block B: welcome once per device; section guides (GuidedTour,
  TourRegistry, overlay, "?" per screen, Ajustes → "Ver todos los
  tutoriales"); "Ej.: …" on every field and check:placeholders in CI; order
  by up/down and drag; appearance in "Mi negocio"; menu scan always first
  with the MenuTextParser plan B and inline edits; verifiable contacts
  (owner steps, admin queue, badges); public trust card; legal data
  correction; route Edge Function (OpenRouteService behind
  RoutingProvider, quota, cache, straight-line fallback) and RouteMap;
  test push and docs/push-setup.md, docs/payments-setup.md.
- Block C: owner hero, cards with trend, quick actions, SVG empty states,
  order cards by state colour, product photos; Lucide icons (docs/brand/icons.md);
  success check, haptics, list stagger and tour motion.
- Migration 52 `20261102000000_round5` (pending review) with
  supabase/tests/round5.sql (27 checks).
- DoD: build (667 kB initial), lint, 813 app tests, 92 script tests, 701
  SQL checks, 133 Deno tests and type check of 11 functions, Deno lint,
  every check (placeholders included), secret scan, audit 0, knip and
  depcheck (known false positives only).
- Not done: no browser run against the real project (the web failure of A2
  and the 5 businesses of A1 were not reproduced; the causes found in code
  are fixed); customer screens got the new cards and route but no full
  redesign.

## Round 3 (2026-10-28, closing)

- docs/round2-status.md (phases 4-7: all done except the screen pass with
  real data on a device). ESLint: errors only for any, naming and 150
  lines; the rest are warnings (zero today).
- Phone verification, free and off: migration 50
  (`20261031000000_phone_verification`: submit_business_for_review checks
  the phone, profiles_phone_guard, sync_verified_phone),
  PHONE_VERIFICATION_ENABLED token, app flow, docs/phone-verification.md,
  threat model T17, verify:backend.
- Password change with Supabase reauthentication code; docs/auth-emails.md
  with the three templates and settings.
- Debug APK built with JDK 21 (com.lumapasto.app 1.0.0, no Firebase
  config) through build + cap sync + assembleDebug (apk:debug's
  generate-env step writes into src/environments, not run this round);
  clear "server not updated" screen; docs/release.md.
- check:wompi-event; safe-defaults script test.
- docs/migrations.md (1-28 applied, 29-50 pending, TOTP and pg_trgm first),
  docs/launch-checklist.md rewritten for the owner (PowerShell).
- DoD green: build, lint, 747 app tests, 85 script tests, 643 SQL checks,
  124 Deno tests, every check, secret scan, audit 0, knip clean.

## Done (round 1)

- PARTE 0 — history cleaned (`backup-before-temp-cleanup` and
  `refs/original/refs/heads/main` kept until the owner says otherwise),
  `AuthFormSubmission` merged, SQL harness restores role and JWT
  (`harness_identity.sql`).
- PARTE 1 — orders anonymised on account deletion (`user_id` set null, notes
  cleared), opening hours checked in `create_order` (America/Bogota,
  `app_local_time`, `business_open_at`), single opening-hours rule
  (`OpeningHours` in TS = `business_open_at` in SQL, shared cases JSON),
  owner notified when a customer cancels (`order_cancelled`),
  `business_closed` message, docs.
- PARTE 2 — 6-digit codes instead of email links: `AuthCodeService`
  (confirm, resend, recovery), `/auth/verify` (numeric one-time-code field,
  paste, auto-send, 60 s resend), unconfirmed login → verify, recovery in two
  steps, new passwords ≥ 8 with letters and numbers, no email enumeration,
  `detectSessionInUrl: false`, `docs/auth-emails.md`.
- PARTE 3 — migration `20261019000000_account_types.sql` (account_type,
  private full_name/phone, consent set by the server, onboarding version,
  become_business_owner, only owners create businesses, max 3) with 20 SQL
  checks; app: `AccountType` and `Phone` value objects, `AccountProfileRepository`
  contract + Supabase implementation, `SessionProfileStore` (accountType,
  profile, home path), `ownerGuard` and `accountHomeGuard`; /business is
  owner-only and the Profile shows it only to owners (the customer
  "¿Tienes un negocio?" sheet comes in PARTE 5).
- PARTE 4 — SQL (migrations 20261020000000 to 20261020000400: status,
  admins, NIT check digit, legal data, documents + private bucket,
  is_business_public in every public policy/view/Storage/create_order,
  submit/review RPCs, re-review trigger, reports; seed approved), `Nit` value
  object, `/admin` (queue, review with signed document URLs, decision with
  mandatory note; `adminGuard` fixed to inject before awaiting), report sheet
  and "Verificado" badge on the restaurant profile. Docs come with PARTE 5.
- PARTE 7 — delete-account removes `business-images` and `verification-docs`
  files before `deleteUser` (500 and account kept if Storage fails), asks for
  a sign-in at most 10 minutes old (403 `reauth_required`, own message in the
  app), CORS moved to `supabase/functions/_shared/cors.ts`. 26 Deno tests
  (`docker run denoland/deno` when Deno is not installed).
- Block A (2026-10-18): every migration applies in order on an empty
  Postgres 17 with the stubs and all SQL suites pass (252 checks); gitignore
  hygiene checked; invariants re-checked with targeted tests (two new SQL
  checks: owners cannot write `verification_note`, admins cannot write
  `verification_status` directly). CI fix committed: spec files isolated
  (`fb359e1`), green 30x alone and 10x in the full suite on one Linux core.
- PARTE 6 — stepped sign-up (`/auth/register`: account type, name and
  +57 mobile, email and password with show/hide, strength meter and common
  passwords, terms + privacy + legal age; metadata for `handle_new_user`;
  draft kept in memory across the legal pages), `/legal/terms` and
  `/legal/privacy` drafts with a visible notice, tutorial `/welcome` per
  account type (scroll snap, Omitir/Empezar, `onboarding_seen_version`,
  shown on landing and from the Profile). Profile: help and legal links and
  the customer "¿Tienes un negocio? Regístralo" (`become_business_owner`).
  Decisions in `docs/DECISIONS.md`.
- PARTE 5 — Luma Negocios: `features/owner`, shell `/owner` with its own tab
  bar (Resumen, Pedidos, Menú, Promos, Mi negocio), business switcher and
  "Añadir" up to 3, `/owner` lands on the last business or the registration,
  owners land on `/owner` after signing in; Resumen (verification card per
  state with linked missing steps and submit/resubmit, Publicado/Pausado once
  approved, today's figures); Mi negocio (data, hours, legal data and
  documents, customer view, tutorial, sign out, delete account); re-review
  warning when a verified business changes name, address or location;
  banner back from the customer view. `/business/**` removed. Docs:
  `verification.md`, `admin.md` (admin SQL), `roles.md`. Not checked in a
  browser (needs an owner session); covered by component tests.

## In progress

- Launch brief (2026-10-19), FASE 1 (database): 1.1 separate consents
  (terms, privacy, age with versions) and is_email_confirmed() required on
  orders, owner upgrade, business creation, review submission, reviews,
  reports and AI quota; 1.3 hourly order caps, owner cancellation after
  accepting, expire_stale_orders (pg_cron when enabled); 1.2 frozen identity
  while pending, stale_review check, pending->suspended and reactivation.
  1.4 public contact columns, business_photos gallery (8), menu cap 200,
  80 files per business folder in Storage (definer count helper), gallery
  in delete-account cleanup. 1.5 multimodal gateway (images, LLM_VISION_MODEL),
  extract-menu (draft only, 8 MB/2 MB, magic bytes, COP parsing, quota
  consume_menu_scan_quota), quota only before model calls, suggest-promotions
  rules fallback (200), recommend cache key with area, bounded readJson,
  shared rule cases (Deno + Vitest), scripts/ai-smoke.mjs.
  1.6 geocode function (photon, nominatim, locationiq, maptiler by secret;
  Colombia only, Nariño bias, rounded bias point, 7-day cache, quota
  consume_geocode_quota 200/user and 5000/day global).
  1.7 push: device_tokens + RPCs, notify_orders/notify_promotions (opt-in),
  notify_promotion, private.push_settings, pg_net poke + pg_cron fallback,
  claim_push_batch, push-dispatch (FCM v1, RS256), docs/push.md.
  1.8 drift test (scripts/db-drift.test.mjs: Storage folders vs delete-account,
  functions in config.toml, grants/search_path/reload/ASCII, every exposed
  function tested), policy_helpers.sql, production-like rehearsal
  (tests/local/rehearsal.sh) which found a real bug: business_verification
  updated legacy rows and NOT VALID checks would reject dirty ones; fixed with
  column defaults. validate-report.sql. 405 SQL checks.
  1.9 export_my_data (own data only, 3 a day).
- DB-FREEZE 2026-10-19 (commit "chore: database freeze"): 28 migrations, 410
  SQL checks, rehearsal 10 checks, 87 Deno tests. From here on, supabase/
  changes only for real bugs, each listed below; other ideas in
  docs/db-followups.md.
  Post-freeze supabase/ changes (no migration or function code):
  - supabase/functions/push-dispatch/fcm.test.ts: test key marker assembled so
    the secret scan stays strict (test only).
- FASE 2.1 auth: unconfirmed emails never get a session (sign-in, restore,
  auth events); unreadable profile -> /account-error (Reintentar / Cerrar
  sesion) via accountReadyGuard on the tab layout and welcome, ownerGuard and
  homePath; never a customer guess. The localhost link in the signup email is
  Supabase config (template with {{ .Token }}, Site URL): launch checklist.
- FASE 2.2 unified map search: businesses filter while typing; Enter or
  "Buscar lugares" asks geocode (neighbourhoods, addresses, places) with the
  map centre as bias; results list (skeletons, empty, quota, unavailable),
  place pin + fly-to. PlaceSearchRepository (Zod, Colombia bounds) and store.
- FASE 2.3 (part 1) Luma Negocios: Contacto y redes (/owner/:id/business/contact,
  parseContact normalises WhatsApp/Instagram/Facebook/https web) and Fotos del
  lugar (/business/gallery: up to 8, re-encoded, caption, order, two-tap
  delete; file removed if the row is refused). Fixed a stale admin spec.
- FASE 2.3 (part 2): Escanear menu (/owner/:id/menu/scan, only with AI_MODE
  remote): up to 4 photos re-encoded (1600 px) -> extract-menu -> review
  (keep, name, price, section; no price = must type it) -> saved one by one
  after the current menu, stops at menu_limit. "Avisar a mis seguidores" on
  running promotions (notify_promotion, errors mapped).
- FASE 2.4 public profile: photo strip (hidden when empty or unreadable) and
  contact links (wa.me, instagram.com, facebook.com, https web; new tab with
  noopener; malformed values never linked) in the Info tab.
- FASE 2.5 push in the app: @capacitor/push-notifications 8.1.3 (Android),
  PUSH_ENABLED gate, PushRegistration (refresh on sign-in when granted,
  enable() from a user action, token removed via SignOutHooks before
  sign-out, tap opens the order or /notifications), NotificationSettings in
  Profile and Mi negocio (orders on, promotions opt-in), POST_NOTIFICATIONS.
- FASE 2.9: scripts/check-interactive.mjs (npm run check:interactive; dead
  buttons/links, keyboard access of clickable non-buttons, literal routerLinks
  vs declared routes) with tests; src/testing/click-all.ts clicks every
  control of a rendered component and reports handler errors (used on the
  account error screen, notification settings and place results).
- FASE 2.10 journeys (src/testing/journeys): sign-up -> refused while
  unconfirmed -> code -> profile error -> Reintentar -> /owner; owner scans a
  menu, fixes a price, saves after the current menu and tells followers;
  customer finds a neighbourhood. Real services, fake Supabase client;
  IMAGE_ENCODER token so tests can replace the canvas encoder.
- FASE 2.6 order alerts: OrderAlertsStore in the owner shell polls pending
  order ids every 20 s while visible (badge on Pedidos on every screen; toast
  + vibration for new ones; first read and business switch never alert).
- FASE 2.7 account: /account/password (current password checked by signing
  in again, then updateUser), public /help (FAQ, legal links, version), links
  and APP_VERSION in AccountActions (Profile and Mi negocio); APP_VERSION kept
  equal to package.json by scripts/app-version.test.mjs.
- FASE 2.8 version check: public/version.json (latest/minimum, drift test),
  UpdateCheck at start-up (web: own origin; APK: UPDATE_SITE_URL, null by
  default), UpdateBanner (Actualizar / Descargar / Mas tarde; required cannot
  be dismissed). FASE 2 closed: build ok (initial 994.73 kB), lint ok, 666
  app tests, 40 script tests, npm audit --omit=dev 0. No supabase/ changes.
- FASE 3: scripts/verify-backend.mjs (npm run verify:backend; anon key only,
  read-only: tables/columns, RPCs, Edge Functions, buckets of the frozen
  schema; expectations tested against the repository).
- FASE 3: apk-verify.mjs (apksigner verify --print-certs, refuses the debug
  certificate, SHA-256 + size to dist/apk-release.json; run after apk:release),
  apk-demo.mjs (throwaway PKCS12 keystore in a temp folder, release build,
  verify, deletes keystore and demo APK, restores environment.deploy.ts).
  Demo run on 2026-10-19: BUILD SUCCESSFUL in 4m 53s, apk-verify ok, 5.7 MB;
  keystore and APK deleted. Fixed apk.mjs on Windows (.gradlew.bat).
  /download page (APK from version.json apk {url, sha256, size}); vercel.json:
  frame-src none, upgrade-insecure-requests, COOP, X-Frame-Options,
  version.json no-store + CORS for the APK; scripts/vercel-config.test.mjs.
- FASE 3 CI: ubuntu-24.04; secret scan (scripts/secret-scan.mjs: private keys,
  service_role JWTs, sb_secret_, provider keys, keystores, Firebase files,
  environment.ts); check:interactive; database job (postgres:17 service, SQL
  suites + rehearsal); functions job (deno 2.5.6 image, tests + type check);
  keepalive.yml (twice a week, anon read of one row, skips without secrets).
- FASE 3 docs: launch-checklist.md (every manual step in order), qa-checklist.md
  (phone findings 1-5 and every screen), runbook.md (symptoms, checks, fixes,
  rollback), release.md (version bump, apk:release, publish, version.json);
  deploy.md lists the six functions and their fallbacks.
- FASE 4 bundle: classic zod in two lazy repositories pulled all of zod into
  the initial bundle through the chunk it shares with zod/mini; both now use
  zod/mini. Initial 995 kB -> 638 kB (222 -> 161 kB transferred). Budget
  750 kB warning / 900 kB error; scripts/bundle-rules.test.mjs forbids
  classic zod and maplibre in the shell and pins the budget.
- Final verification 2026-10-19: build ok (initial 637.74 kB), lint ok, 668 app
  tests, 58 script tests, 410 SQL checks + 10 rehearsal checks, 87 Deno tests,
  npm audit --omit=dev 0, secret scan ok, check:interactive ok. Since the
  freeze (3621e42) the only supabase/ change is the push-dispatch test fixture.
  Next for the owner: docs/launch-checklist.md.

- Block D done: migration 20261021000000 (discounts, trigger, server prices in
  create_order; 23 SQL checks), customer /promotions (sort, filters, states,
  Pedir), shared PromotionCard reused by the restaurant Promos tab, links from
  Descubrir and "Cercanos a ti", discounts on feed and map cards, owner form
  with product, percent, final-price preview, margin notice, Terminar ahora and
  the visible limit of 5.
- Block E done (E1-E8): LLM gateway `_shared/llm` (Gemini, OpenAI-compatible,
  Anthropic by secrets), migration 20261022000000 (quotas, cache, candidates,
  owner sales summary), Edge Functions `recommend` and `suggest-promotions`,
  app `AI_MODE` (rules by default, remote with fallback), /ai reason sentence
  and "Otra opción", "Recomendada por Luma IA" in Promos, "Ideas de Luma IA"
  in Resumen and Promociones (prefilled form, owner publishes), docs/ai.md.
  E9: `PAYMENT_GATEWAY` (`PayAtPickupGateway`, used by checkout) and the Wompi
  plan in docs/payments.md (not implemented).
- PARTE 8 / Block F (APK, no performance work): `npm run apk:debug` and
  `apk:release` (`scripts/apk.mjs`, signing from LUMA_KEYSTORE_*, JDK 17-24
  detection with JBR fallback), version from package.json (1.0.0), manifest
  hardened (no backup, no cleartext, location), back button and keyboard
  (`NativeShell`), icon and splash from `assets/logo.svg`, CSP evaluated,
  docs/android.md. assembleDebug passed locally with JDK 21.
- Block G done: offline vs service errors, offline notice, dev warning for
  template environment values, 404 page, AppErrorHandler, haptics, AA
  contrast check of the new screens in the four themes (error text moved to
  `text-danger-fg`), docs (README, ARCHITECTURE, deploy, mocks, orders,
  legal-notes, DECISIONS). Local test Postgres stopped.

## Left

- Review and apply the 21 round 2 migrations (20261029000000 to
  20261030000700) in order; run `supabase/tests/local/run.sh` against a
  copy first.
- Online payments: set the Wompi secrets and cron, deploy the four payment
  functions, run the sandbox list in docs/payments-checklist.md, then
  `payments_enabled = 1`.
- Signed release APK with the owner's keystore and a test on a device.
- Visual pass on a device of the screens with real data (business profile,
  order detail, owner panel, admin) — the screen harness covers empty
  states only.
- Edge Functions under the same lint limits (Deno lint) and depcheck
  (not run: an unpinned npx package; knip covers dependencies).
- Optional: rewrite history to drop supabase/.temp before making the
  repository public (docs/security-findings.md).

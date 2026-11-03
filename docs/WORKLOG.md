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

- Visual pass in a browser of the owner and admin screens (needs a session
  with an owner/admin account; covered by component tests only).
- Migrations 5 to 21 to review and apply (docs/migrations.md), then
  VALIDATE the NOT VALID constraints.
- To switch Luma IA to remote: deploy the functions and set the secrets
  (docs/ai.md), then AI_MODE = remote.
- Gradle/AGP upgrade to build with JDK 25 (Android Studio's current JBR).
- PARTE 9 (Wompi) and the performance section of PARTE 8: on hold until the
  owner asks; the Wompi plan is in docs/payments.md.

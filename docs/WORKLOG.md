# Worklog — fase roles, verificación y APK

Plan: `docs/roadmap/fase-roles-y-apk.md` (removed in round 14, see docs/cleanup-report.md). This file
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

## CI and cleanup round (2026-11-12)

Goal: GitHub Actions green and a clean repository, with no change of app
behaviour (no file under `src/` or `supabase/` changed).

- **Fixed: the flaky WebKit e2e step** (failed on Dependabot branches and on
  `v1.0.2`; the same commit failed on push and passed on its PR). The
  simulated Storage answered 404 to the signed photo URL, so LumaAvatar hid
  the `<img>` and the test raced the 404. Storage now serves uploaded
  objects; every fixed pause of the e2e tests is a wait for a condition
  (`e2e/support/waits.mjs`); guides start as seen and `e2e/guides.e2e.mjs`
  checks all 11 on purpose; Realtime subscriptions are awaited before the
  other phone acts. Two more races showed up and were fixed: counting
  checkout elements before the screen had drawn them.
- **CI**: `e2e` job of its own (in parallel with `verify`), WebKit runs
  even when Chromium fails, traces and screenshots of failed tests are
  uploaded on failure; push only for `main` and `v*` tags (pull requests
  once). knip pinned (6.43.0) and run over `e2e/` and the styles;
  `.depcheckrc.json` lists the known false positives.
- **Removed**: 6 unreferenced captures in `docs/images`; locally the two
  merged worktrees and their branches, `auth-form-submission-proposal`,
  `dist/`, `coverage/`, `.angular/` and an editor-generated
  `.vscode/settings.json`. Audit and evidence: docs/cleanup-report.md.

Stability: WebKit suite 5 times in a row and Chromium 3 (the last of each
with 11 of 12 cores busy), then WebKit 3 more times at the end: all green.
Two local runs were cut by Windows modern standby (event log 08:37–09:20);
the final runs held a wake lock. Not related to the code.

Verification (before → after, same machine): build initial 702.69 kB →
702.69 kB; lint 0 → 0; unit 1,205 → 1,205 (coverage 84.7 % statements,
80.39 % branches, 77.81 % functions, 88.27 % lines, unchanged); scripts
192 → 192; e2e Chromium 18 pass / 6 skipped (WebKit-only) and WebKit 21 /
3 (Chromium-only), with 3 new guide tests in both; every `check:*` and
`check:responsive` ok; secret scan ok; `npm audit --omit=dev` 0; jscpd
0.82 % (45 clones, unchanged); knip 0 issues and 0 hints; depcheck "No
depcheck issue"; Deno 14 suites, 180 tests, 13 type checks, lint of 111
files clean; SQL 54 suites, 954 checks, and the rehearsal (Postgres 18
locally, 17 in CI); clean clone: `npm ci`, `build:prod` as Vercel and
`npm run build` with the example environment as CI.

## Round 14 (2026-11-07): review before the university presentation

### Phase A: what the phone test found

- Picked up left the last timeline circle empty: the last step was "current". `OrderProgress`
  (shared) completes the last step; the timeline moved to `shared/orders`.
- The order detail printed "Pagar al recoger" for every order. `OrderPaymentState` and the
  `paymentState` pipe read the method and status of the order; list, detail and business card.
- "Conciliar ahora": `reconcile-payments` answered the browser preflight with 405 and no CORS
  (checked against production), so the POST never left. It uses the shared preflight now.
- The 12:05-12:19 attempts never reached Wompi and stayed pending. Migration 65: status
  `expired`, `expire_abandoned_payments()` in the expiry job; vectors 49 -> 64.
- Phase 5 leftovers: the refund policy said "until accepted"; checkout and policy now say
  "until the kitchen starts" (`cancel_order`). Phase 7: `e2e/perf.mjs`, results in
  `docs/optimization-report.md`.
- Luma IA icon: the pin of the new logo with a spark.

### Phase B: security

History of every ref scanned: no real secret published (docs/security-findings.md). .gitignore and
the secret scan cover the luma.ps1 files. RLS, views, functions, buckets, CORS, CSP and logs reviewed
read-only in production; the only gap was the CORS of reconcile-payments (fixed in phase A).

### Phase C: code quality

No hard-coded user text in templates; PowerShell comments in English. Named constants for the loose
limits of the Edge Functions. Auth pages, tab layout and tour on Tailwind (auth-page.css removed).
Code only its tests used removed (cleanup report). Migration 66 indexes seven foreign keys.
Before/after table in docs/optimization-report.md.

### Phase D: repository

The design prototype (old themes) and four status documents of finished rounds removed; README
rewritten for the presentation with captures of both themes; docs/demo.md is the presentation
script. Feature matrix, architecture, CLAUDE.md and steering match the project. Before/after
table in docs/cleanup-report.md.

### After round 14

- CI on Linux: luma.ps1 and its tests run in pwsh without TEMP or USERPROFILE; gitleaks-action v3.
- README is now a short presentation in Spanish for visitors; everything technical it had
  (architecture, run, payments sandbox, tests, database, layout, documentation) moved unchanged
  to docs/development.md.
- public/legal/index.html (generated by build-legal) lists the four legal pages, so the root of
  GitHub Pages is no longer a 404. Links between the pages are relative: the old `/legal/...`
  links were a 404 on Pages (served under /Luma/). Vercel rewrites `/legal` and `/<page>.html`.

### Phone tests of APK v1.0.0 and iPhone

- Own SMTP documented (docs/auth-emails.md); the "team addresses only" limit is gone.
- Photo: Perfil never passed the photo to the avatar. Three photos in production prove upload,
  policies and set_avatar work. Picker `image/*`, no silent step, a message for each failure.
- Map filters: only the chips scroll; the map buttons are a row. `check-map-chrome` measures 1, 3
  and 6 filters at 320 to 430 px and tablet, with 200 % text and both themes.
- Location: on an emulator with the permission and the GPS on, `navigator.geolocation` at low
  accuracy timed out and every error became "denied". Now `@capacitor/geolocation` in the app,
  the browser on the web, and each failure told apart. Last attempt in Información técnica.
- iPhone web: home-screen metas, 16 px fields, CSP `blob:` for the photo preview, e2e in WebKit
  with the iPhone 13 profile. Native project in `ios/`, not compiled (docs/ios.md).

### Phone tests of APK 1.0.1

- Discover: the top controls are one row under the status bar; `safe-area.e2e` emulates a notch
  on every main screen.
- One reload icon (`LumaRefreshButton`) for the freshness note and failed reads. Words stay for
  updating the app, paying again, the location prompt, re-sending a menu photo and notifications.
- Map label: the real zone by reverse geocoding on a point rounded to about 110 m, cached here and
  in the function; following from 200 m, only while the screen is visible; the centre of the map
  when the user moves it, with a way back. "Centro de <town>" only without a location.
- Información técnica recorded the permission of the moment before the system dialog turned the
  location on ("ok ... servicesOff"); it now reads it again after a successful reading.
- Outside Pasto: an empty map explains it and offers "Explorar Pasto".
- Offline: the "Sin conexión" strip pushes every screen down instead of covering it. Screens use
  `--inset-top` (`styles/safe-area.css`), the status bar or the height of the strip, which glides
  unless the user prefers reduced motion; `offline-notice.e2e` cuts the network on four screens.

### Last round before the presentation

- Contact verification: in production the Instagram and website of the business had no request at all
  (the only one ever was a phone); the card said "Pendiente de verificación" before anything was sent.
  States now: Sin verificar, En revisión, Verificado, Rechazado with the reason. Migration 67 tells
  every admin (in the app and by push) and makes a rejection carry a reason.
- Back: the browser history mirrors the screen tree (`core/navigation`: ScreenTree with the parent
  of each screen, HistoryPlans, HierarchicalLocationStrategy, BackNavigation). Going deeper adds an
  entry, a tab or a sibling replaces it, an ancestor goes back to it; so the phone's button and
  gesture, the browser's back and the arrows of the app all lead to the parent. Sheets, the guide
  and the welcome close first; the keyboard hides first; at a root back goes home; at home the APK
  is minimised. The guide bubble no longer falls off screen over a Discover card.
- Pickers: LumaSelect is now a field that opens a bottom sheet (the chosen option marked, a search
  from 9 options, arrows, Home and End, 44 px options), never Android's grey dialog. The business
  switch, the promotion item, the hours (quarter hours) and the promotion dates (DateTimeFields:
  day and time) use it too; `npm run check:pickers` fails on a native select, time or date input.
- Headers: LumaScreenHeader (back arrow as an icon, title, actions as labelled icon buttons) on the
  admin screens, "Mis datos" and every owner screen (PanelHeader). "Pagos, avisos y registro" and
  "Información técnica" are icon buttons; "Volver a la cola" is the arrow.
- Registro reciente: AuditText says each action and its detail in words (decision, kind of
  contact); never a key or a status. walk.e2e fails when a screen shows a translation key or an
  internal status (e2e/support/raw-text.mjs).
- Review: no `any`, no `console.log`, no file over 150 lines, every component OnPush and
  standalone, `inject()` everywhere, no feature importing another; knip clean (one key, one style
  and two exports removed, docs/cleanup-report.md). Option 6 of luma.ps1 accepts the APK Gradle
  reused when it is this version. Version 1.0.3.

- Found by the final verification, all from the new history: on the web, paying online navigated
  inside the app while the page was leaving for Wompi and the move back cancelled it; a sheet or
  guide closing by itself moved the history and cancelled a page load starting then; signing in
  moved the history back and WebKit crashed. Now nothing navigates while the page leaves, a
  closing layer leaves a spent entry that the next back skips, and signing in starts the trail
  again in place.

Repository before/after this round (`217f4f6` → `cf1e770`, `git ls-tree`; the clean-up after it changed under 30 lines):

| Area | Files | Folders | Lines |
| --- | ---: | ---: | ---: |
| src/app | 823 → 844 | 260 → 263 | 54,375 → 55,981 |
| src/testing | 12 → 14 | 3 → 3 | 664 → 773 |
| e2e | 18 → 20 | 2 → 2 | 1,270 → 1,368 |
| scripts | 94 → 96 | 5 → 5 | 6,300 → 6,422 |
| supabase (migrations, tests, functions) | 261 → 263 | 25 → 25 | 22,296 → 22,562 |
| public/i18n | 2 → 2 | 2 → 2 | 5,290 → 5,360 |
| docs | 85 → 85 | 8 → 8 | 10,694 → 10,718 |
| Repository | 1,454 → 1,483 | 365 → 368 | |

## Round 13 (2026-11-07)

### Phase 0: scripts/luma.ps1 changed nothing in production

Cause, proved: `npx.ps1` and `npm.ps1` (npm 11) re-read the text of the calling
line, so `& npx --yes supabase @args` inside a function never passed the arguments.
The CLI showed its help and exited 0, and the option said OK. Evidence: the same call
with a nonexistent project ref returned 0 through the wrapper and 1 through `npx.cmd`.
Last function deployed 2 Nov 16:02, last secret loaded 3 Nov 11:36; the first commit of
the script is 3 Nov 12:13, so it never changed the project. Options 6 and 7 had the same
fault: `npm run` listed the scripts and said the APK was built.

Fix: `npx.cmd` and `npm.cmd`; `--remote=<ref> --yes`; a fixed CLI version; a failed
command stops the option; OK only after `secrets list` and `functions list` confirm it,
dated by this run. New option 8. Option 3 reads `functions.env` too and never loads a
`*_prod_` key. The secret scan knows the Wompi private key and secrets.

### Phase 1: notices in the bar

`push-dispatch` answers 200 since the deployment. Migration 62 retries only the phone
that failed (1, 5, 15 minutes). Migration 63: the push status reads only its own answers:
the last row of `net._http_response` could belong to the payments cron.

### Phase 2: phone log

OPTIONS answer 204 with the origin for `https://localhost` and `http://localhost:4200`
on the 9 browser functions: the CORS error was the missing function. Returning to the app
fired two re-reads ("visibilitychange" and "resume"): now one. A socket dead in the
background reconnects on return. `insetsHandling: 'native'`: nothing injects unused
`--safe-area-*`. Map pixel ratio up to 2, 40 cached tiles, feed cards `content-visibility`.
Capacitor logs only in debug builds, stated in `capacitor.config.ts`.

### Phase 3: routes

The deployed `route` was from 2 Nov: older than the public OSM provider (4 Nov) and with
no key, so every answer was the straight line, and `ai_cache` held no route. The deployment
fixed that. "Cómo llegar" only re-framed the map: now it draws the route or opens the phone's
navigation (`geo:`). `isStyleLoaded()` turns false while tiles load, so a route could wait
for a "load" event already gone and never appear. The map follows the customer (50 m). The
order detail lost its straight-line time. The straight line is dashed and labelled.

### Phase 4: payments, part one

`cron.job` in production had no `luma-expire-stale-orders` nor `luma-reconcile-payments`:
their migrations ran before pg_cron was on and skipped the block, so orders never expired.
The reconcile job also never woke for card refunds to void, a gap of round 12. Migration 64
schedules both. `npm run wompi:replay` tests forged, repeated and late events on the sandbox.

### Phase 4: the return from Wompi

From the APK the function sent `redirect-url=luma://payments/return`, and Wompi only takes
https: "redirectUrl: URL invalida". The APK now returns to `/pago-listo.html` on the web
domain (`PAYMENT_RETURN_URL`, from `web.env`), which hands over to `luma://`. It says nothing
about the result. If the customer does not come back that way, the order screen re-reads the
server on return to the app. The "final price" note is only for pay at pick-up.

### A clean clone did not build

Vercel failed on `1f6e748`: `environment.ts` is gitignored and a file replacement needs the
original. `generate-env.mjs` now creates it from the example, with a copy that cannot overwrite.
Reproduced in a clean clone, which also showed `PUSH_ENABLED=1` stopping the web build for an
Android file: the web build no longer applies that rule. New CI job `clean-build`.

### Phase 6: themes (done before finishing phase 4, as asked)

The themes in the code were Sky, Night, Lacquer and Maize; Indigo, Midnight, Pearl and Sunset
exist only in `docs/design-prototype`. All of them migrate: dark to `ciruela`, light to `crema`.
`ciruela` is the base of `tokens.css`; `crema` overrides every token. The brand gradient left the
feed placeholder, the owner hero and the welcome slides. `MapTheme` paints the vector style from
`--color-map-*`, and hides 3D buildings. Contrast adds the gradient stops and the map pairs.

## Round 12 (2026-11-06)

Prompt: notifications, a full review of the files, the new icon, three palettes,
motion, Wompi, cancellation, technical info and the data copy. No push, no deployment,
no migration applied.

- Push: `push-dispatch` and its secrets are not in the project, every poke answered 404
  (read in `net._http_response`). The code is ready: system notification with the app
  open, default channel, FCM's code in the answer, the device test says the truth (59).
- Icon: docs/brand/icon-generator.py cuts assets/icon-source.png; palettes proposed, none
  applied (the owner chooses).
- Motion: shared order card, lists rise in, `--ease-spring`, `ValuePop`, `LumaSuccess`.
- Payments and cancellation: a message per failure, customers cancel until `preparing`,
  automatic void of cancelled card payments (60).
- Technical info only at /admin/technical; /account/data with a summary, and a readable
  file (61).

## Round 11 (2026-11-05)

Prompt: close B6, then admin, push and error handling on `main` (no push, no
deployment, no migration applied). Migrations 1 to 56 are taken as applied and
57 as pending (the owner's statement; nothing here confirms it). 58 is new.

- B6: `@defer` of the route map proven with `getDeferBlocks`; `NgOptimizedImage`
  dropped (docs/quality-report.md); R8 on for release, static check of
  `mapping.txt` (runtime still to be tried on a phone).
- Admin: `admin_access` distinguishes `error` and keeps its code,
  `/admin/access-error`, `AdminEntry` in shared and in Mi negocio, MFA failures
  caught, QR with the secret, `DeviceStatus` in Información técnica.
- Push: `PushPlatform` keeps its own listeners (renewal and tap with the app
  open), no orphan rejection; `PushTokenLink` and `PushTokenStore` unlink a token
  of an earlier run; `PushDiagnostics`; `npm run check:google-services`;
  migration 58 (notices wait for a token within `push_claim_window_minutes`, and
  the cron wakes only with work).
- Errors: `ErrorCode`, map failures by kind, `AuthFormSubmission` catches both
  steps, `LandingNavigation`, `.catch(() => undefined)` replaced by ErrorLog in
  start-up and payment return.
- Tests are hermetic: test build with the placeholder environment and a client
  without network in `src/test-providers.ts`.

First phone test (APK of 4666cc0): "Permitir notificaciones" did nothing and every push
step was empty. `PushPlatform.plugin()` returned Capacitor's proxy from an async function,
its `then()` rejects without settling the promise, so no catch ran. Fixed in baecfad, with
a double of the proxy for every plugin (the earlier double was a plain object that skipped
`plugin()`). `socket closed: 1006` needs no change: realtime-reconnect.spec.ts shows the real
client coming back alone. After that fix: 18 affected spec files, 67 tests; the whole unit
suite was not run again.

Verified on 2026-11-06: exact results in docs/quality-report.md ("Close of round 11").
e2e found two accessibility failures on the owner panel, fixed. npm run doctor now
sends pending migrations to `db push --remote`.

Left: apply 57 and 58 after review, deploy nothing new (no Edge Function changed
in behaviour except logs: delete-account, geocode, whatsapp-webhook, route), try
the phone list in docs/qa-checklist.md, signed release APK with R8, payments
checklist when Wompi is turned on.

## Round 10 (2026-11-04)

Prompt: round 10 (phase A "fallos del teléfono", phase B "lo que quedó de la
ronda 9"). Migration 56 is reviewed and applied by the owner; database
changes go in 57 (`20261107000000_round10.sql`, pending review). Vitest runs
in two forked workers fixed in `vitest.config.mjs`.

- B1 done: LumaNotice committed after its full unit run (208 files).
- Phase A done:
  - A1: `ErrorLog` (last 20, masked) + `AppErrorHandler` shows only
    user-facing errors; realtime and push never throw (outages logged once,
    typed push problems with their own messages); "Errores recientes" in
    Información técnica (Perfil and Mi negocio).
  - A2: recovery in three steps (`RecoveryFlow`), `PasswordRules` +
    `PasswordChecklist` in sign-up, change and recovery, shared vectors;
    docs/auth-emails.md asks for the same Supabase rule.
  - A3: new LocationPicker (fixed pin, GPS with accuracy, bounded search,
    reverse proposal, warnings); geocode function with `within` and
    `reverse`; sector and reference columns (57); docs/location.md.
  - A4: the map showed only with the customer's location and only for
    public businesses; now the pin always, the route in accepted/preparing/
    ready, `order_pickup_point` (57) for hidden businesses.
  - A5: "Combos para {momento}" (one config file, ComboBuilder, ranking of
    the recommendation).
  - A6: `e2e/walk.e2e.mjs` and docs/qa-checklist.md.
- B2 done: fallback on rate limit and unknown model, `provider_truncated`
  with one retry at twice the budget, budgets 8192/2048, `thinkingLevel`
  low for Gemini 3, `npm run ai:smoke [-- recommend]`.
- B3 done: `Invoke-LumaNpm` returns an integer, adb found in PATH /
  ANDROID_HOME / Android Studio SDK with the "unauthorized" explanation,
  option 1 makes a real generateContent call (503/429 = APAGADO), option 6
  creates app.env.

## Round 9 (2026-11-03)

Phase 1 (fallos pendientes):
- Migration 56 `20261106000000_round9` (pending review): approving a ready
  business publishes it; daily creation guard 10 (only "3 por cuenta" is
  shown). supabase/tests/round9.sql. Summary: "Tu negocio está aprobado pero
  aún no se ve" + what is missing + "Publicar ahora".
- LLM gateway: 2 retries with backoff and jitter for 5xx/"overloaded",
  `LLM_FALLBACK_MODEL`, reason `provider_unavailable`; menu scan has
  separate messages (saturated + Reintentar, quota, key, model).
- `scripts\luma.ps1` (7 options, docs/luma-setup.md), setup-push.ps1 on
  npx/--use-api/USERPROFILE, `npm run doctor` (Management API).
- Legal pages on GitHub Pages (`legal-pages.yml`, docs/pages-setup.md);
  docs/release.md lists every build variable.

Phase 2 (tiempo real, docs/realtime.md):
- Migration 56: `catalog_events`, `order_events` (ids only), triggers,
  RLS, pruning, publication with exactly those tables;
  supabase/tests/realtime_events.sql.
- `RealtimeService` (batches of 500 ms, reconnection with backoff, 30 s
  fallback poll, foreground and network refresh), `FreshnessNote`,
  `appPullToRefresh`; map, Descubrir, ficha, pedidos (cliente y dueño),
  alertas y avisos refresh without flicker.

Phase 3 (todo funciona de punta a punta, docs/feature-matrix.md):
- `npm run test:e2e` (CI too): sign-up, pick-up order with the owner's
  answer live, owner panel, simulated Wompi sandbox payment; simulated
  Supabase, Realtime and Wompi; no console errors, no unsimulated request.
- Gaps closed: web payments return to `/payments/return` (create-payment
  picks the return by origin), "Descargar mis datos", plurals
  (`PluralTranspiler`), technical words out of the texts, `id="null"`.
- Option 7 no longer stores a Supabase token: CLI session, optional token
  only in memory.

Phase 4 (dependencias): maplibre-gl 6.15.0, postcss 8.5.31, Angular 22.2.4
(build/cli 22.2.5), typescript-eslint 8.72.0, jsdom 30.1.3, vitest 5.0.5,
supabase-js 2.118.0 (app and the 13 functions), zod 4.6.7, eslint 10.13.0;
each verified on its own; npm audit 0. The open Dependabot PRs are
superseded by this commit.

## Round 8 (2026-11-02)

Phase 1 (fallos y legal público):
- Login: e-mail lower-cased and trimmed, keyboard flags, show/hide password,
  Supabase error codes mapped.
- Menu cards wrap; prices "$20.000".
- Build flags (`scripts/build-flags.mjs`): AI_MODE, PUSH_ENABLED,
  SUPPORT_WHATSAPP, LEGAL_CONTACT_EMAIL (they were constants before).
  Menu scan says why it fails; extract-menu answers a reason.
- Test notification only for admins ("Probar mi dispositivo");
  scripts/setup-push.ps1.
- Contact verification explains every block.
- Migration 55 `20261105000000_round8` (pending review): admins-only test
  notification, `show_pending_businesses`, pick-up only while in review;
  supabase/tests/round8.sql.
- Public legal pages (`npm run build:legal`), data deletion page,
  vercel.json short URLs, docs/vercel-setup.md, docs/meta-live.md, app icon.

Phase 2 (cualquier pantalla y claridad):
- Type in rem with clamp(); fluid base rules; `npm run check:responsive`
  (8 sizes × normal and 200 % text) in CI; fixes: menu row image
  (LumaImage contents host), tab labels, 44 px targets, hero name.
- Verification card in three steps; Tutoriales and Legal (tabs) screens;
  compact customer-view banner and hero invitations.

Phase 3 (imagen visual):
- Saturated palette (deep Andean blue, ají, sun yellow), deep-blue Night;
  native colours, favicon, theme-color.
- Food doodles (docs/brand/doodles.md): line and colour tiles, CSS mask by
  token, drift with reduced motion respected, veils; quiet-doodle check in
  check:contrast.

Phase 4 (limpieza y optimización, docs/optimization-report.md):
- 914 → 822 files (−10.1 %), lines −1.3 % (goal not met, see DECISIONS),
  initial bundle 670.15 → 670.04 kB; clones 79 → 51.
- Templates inline, same-responsibility merges, single-implementation
  abstractions collapsed, `SupabaseEnv` and `SecureCompare` shared by the
  Edge Functions, design preview and its keys removed.
- Green: build, lint, 862 app tests, 112 script tests, 154 Deno tests +
  check + lint, 776 SQL checks, every check:* (responsive too), secret
  scan, npm audit 0.

## Round 7 (2026-10-31)

- Migration 54 `20261104000000_round7` (pending review; 52 and 53 applied):
  daily limit of business creations, validation functions and CHECK
  constraints NOT VALID, discount 1-90, cleaned sign-up names and order
  notes, phones compared in +57, `verified_by` hidden from owners, contact
  requests limited per kind; supabase/tests/round7.sql (41 checks) and the
  shared vectors.
- Cómo llegar with a pie / bicicleta / moto / carro (ORS profiles, moto
  approximate, remembered mode); route function profiles.
- /owner guarded on every child route; customers get the invitation.
- core/validation (Specification), every form with errors on blur and on
  submit, numeric fields with digits only, `check:validation` in CI,
  docs/validation-matrix.md and docs/data-quality.sql.
- verify-website: IPv6 as bytes, DNS over HTTPS fallback; websites need
  https://.

## Round 6 (2026-10-29)

- Migration 53 `20261103000000_round6` (pending review, depends on 52):
  strategy per contact kind, WhatsApp inbound verification for
  service_role, website checks; supabase/tests/round6.sql (22 checks).
- Edge Functions `whatsapp-webhook` (Meta subscription, HMAC of the raw body,
  idempotent ids, no number stored, never replies) and `verify-website`
  (SSRF rules); both inert until configured. verify-backend knows them and
  reports migration 53 RPCs as pending.
- App: `ContactVerifier` strategies (WhatsApp inbound, website file, manual
  admin), "Verificar con WhatsApp" with a 3 s / 2 min watch, landlines
  explained, "Comprobar ahora" for websites; Instagram and Facebook stay
  manual. Mi negocio → Ayuda → "Información técnica" (PanelQueryLog).
- docs/whatsapp-setup.md (Spanish, step by step).
- DoD: build (667 kB initial), lint, 823 app tests, 92 script tests, 723
  SQL checks, 146 Deno tests and type check of 13 functions, Deno lint,
  every check, secret scan, audit 0, knip and depcheck (known false
  positives only).

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

- Round 2 status, at the end of this file (phases 4-7: all done except the screen pass with
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

## Status of the rounds

Moved here from the per-round STATUS files (kept as they were written, so the
migration states are those of their date; docs/migrations.md has the current one).

### Round 10

| Phase | State |
| --- | --- |
| B1. LumaNotice | Done (committed first) |
| A. Fallos del teléfono (A1–A6) | Done |
| B2. IA (fallback, budgets, ai:smoke) | Done |
| B3. scripts\luma | Done |
| B4. route: second free provider | Done |
| B5. Realtime privacy (migration 57) | Done with phase A (57 holds it) |
| B6. Phase 5 rest (round 9) | Done (see "Round 11") |

Migration 57 (`20261107000000_round10.sql`) is pending review; 56 is
reviewed and applied by the owner (57 needs it first).

Verification at the close of phase A: build (initial 676.42 kB), lint 0,
unit 224 files, 140 script tests, Deno 14 suites + entry check + lint,
836 SQL checks, 6 e2e, every check:*, secret scan, npm audit 0, knip 0.

### Round 9

| Phase | State | Commit |
| --- | --- | --- |
| 1. Fallos pendientes (1.1–1.6) | Done | see git log "round9 phase 1" |
| 2. Tiempo real | Done | see git log "round9 phase 2" |
| 3. Todo funciona de punta a punta | Done | see git log "round9 phase 3" |
| 4. Dependencias | Done | see git log "round9 phase 4" |
| 5. Calidad, seguridad, rendimiento y optimización | In progress. Done and committed: strict TypeScript + noUncheckedIndexedAccess (core, design-system, shared, features, functions; one commit each), every code file within 150 lines, complexity 10 as a lint error, knip at 0. Uncommitted: LumaNotice (51 message boxes unified in the design system; build and lint green, the unit test run was stopped by the system for low memory and must be run again). Pending: jscpd, docs (quality report, mermaid, commits), coverage thresholds, Angular 5.2, performance 5.3, security 5.4, accessibility 5.5, observability 5.6. | |

Migration 56 (`20261106000000_round9.sql`) is pending review, not applied;
55 is also pending review.

Phase 1 closed green: build (initial 670.04 kB), lint, 866 app tests, 134
script tests, 179 Deno tests + check + lint, 794 SQL checks, every check:*,
secret scan, npm audit 0, knip unchanged (40 / 34).

### Round 8

| Phase | State | Commit |
| --- | --- | --- |
| 1. Fallos y legal público (A1–A7) | Done | see git log "round8 phase 1" |
| 2. Cualquier pantalla y claridad (B1–B4) | Done | see git log "round8 phase 2" |
| 3. Imagen visual nueva (C1–C2) | Done | see git log "round8 phase 3" |
| 4. Limpieza y optimización (D1–D3) | Done (line goal not met: docs/optimization-report.md) | see git log "round8 phase 4" |

Migration 55 (`20261105000000_round8.sql`) is pending review; 54 is applied.

### Round 2 (phases 4 to 7)

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

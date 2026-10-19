# Worklog — fase roles, verificación y APK

Plan: [docs/roadmap/fase-roles-y-apk.md](roadmap/fase-roles-y-apk.md). This file
says what is done, half done and left, updated with every commit so any
session can resume.

How to verify: `npm run build`, `npx ng lint`, `npm test -- --watch=false`,
`npm run test:scripts`, `npm audit --omit=dev --audit-level=high`, and the SQL
suites with `supabase/tests/local/run.sh` (local Postgres on port 54329 in the
agent's sessions).

## Done

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
- Block G in progress: network errors split into "sin conexión" and "servicio
  no disponible" (ConnectivityService, also @capacitor/network), global
  offline notice, dev warning for template environment values, 404 page,
  AppErrorHandler (friendly notice), haptics on add to cart, favourite and
  order. Next: screen pass and docs (README, ARCHITECTURE, deploy, mocks,
  orders, legal-notes).

## Left

- Promotions with discounts (brief block D), AI
  with a swappable provider (block E, owner authorised it in the brief),
  8 (APK only, no performance work), polish (block G), 10 (docs).
- PARTE 9 and the performance section of PARTE 8: on hold until the owner
  asks.

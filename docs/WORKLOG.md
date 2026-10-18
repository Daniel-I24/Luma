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

## In progress

- Session 2026-10-18 (block A of the owner's brief): CI fix, tree audit,
  clean install of every migration, invariants re-checked.

## Left

- 5 (Luma Negocios shell), 6 (signup steps, legal pages, tutorial), 8 (APK only, no performance work), 10 (docs).
- PARTE 9 and the performance section of PARTE 8: on hold until the owner
  asks.

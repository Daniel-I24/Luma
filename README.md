# Luma

Mobile-first app to discover local restaurants and shops in Pasto (Nariño,
Colombia). **Customers**: interactive map with live open/closed status, a
vertical feed, promotions with real discounts, Luma IA recommendations,
favourites, reviews, cart and pick-up orders with notifications.
**Business owners** ("Luma Negocios"): register and verify their business,
publish it, manage menu, hours, photos and discounts, take orders and get
promotion ideas. **Review team**: approves businesses and handles reports.
Spanish UI by default, English as second language. Web (Vercel) and Android
(Capacitor).

## Stack

| Area | Tech |
| --- | --- |
| Frontend | Angular 22 (standalone, Signals, `@if/@for`, OnPush, View Transitions) |
| Styles | Tailwind CSS v4 on design tokens (`src/styles/`), four themes |
| Data & auth | Supabase (Postgres + RLS, Auth with 6-digit codes, Storage, Edge Functions in Deno) |
| AI | Rules in the app by default; optional Edge Functions with a swappable LLM gateway (Gemini, OpenAI-compatible, Anthropic) |
| Map | MapLibre GL with OpenFreeMap tiles |
| i18n | Transloco (`public/i18n/es.json`, `en.json`) |
| Validation | Zod at the boundaries |
| Mobile | Capacitor 8 (Android) |
| Tests | Vitest (app), `node:test` (scripts), Deno test (Edge Functions), SQL suites on Postgres |
| Hosting | Vercel (static build) |

## Requirements

- Node.js 24 and npm 11 (`packageManager` in `package.json`)
- A Supabase project (or the Supabase CLI for a local stack)
- Optional: Android Studio and a JDK 17-24 for the APK; Deno (or Docker) for
  the Edge Function tests; Docker or Postgres for the SQL tests

## Getting started

```sh
npm ci
cp src/environments/environment.example.ts src/environments/environment.ts
# edit environment.ts with your Supabase URL and anon key (never commit it)
npm start            # http://localhost:4200
```

With the template values the app shows a development notice: it cannot
reach Supabase until `environment.ts` has real values.

## Environment variables

| Where | Variable | Notes |
| --- | --- | --- |
| Local dev | `src/environments/environment.ts` | Gitignored. URL + **anon** key only. |
| Production build / APK | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Read by `scripts/generate-env.mjs`; privileged keys are rejected. |
| APK signing | `LUMA_KEYSTORE_PATH`, `LUMA_KEYSTORE_PASSWORD`, `LUMA_KEY_ALIAS`, `LUMA_KEY_PASSWORD` | Only for `npm run apk:release` ([docs/android.md](docs/android.md)). |
| Edge Functions | `ALLOWED_ORIGINS`; for AI also `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL` | Supabase secrets; `SUPABASE_*` are injected. |

The service-role key and every AI key live only in Supabase secrets.

## Database: migrations and seeds

Apply `supabase/migrations/` **in filename order**.
[docs/migrations.md](docs/migrations.md) lists each file, which ones are
applied and which are pending review, and the `VALIDATE CONSTRAINT`
commands. A clean install of all of them passes every SQL suite.

Seeds (development data, 5 businesses in Pasto, approved):

1. `supabase/seed.sql` — businesses, hours and promotions. Needs an
   `auth.users` row for the placeholder owner (see the file header).
2. `supabase/seed_menu_items.sql` — test menus, linked by business name.

Every table has Row Level Security. Who may do what:
[docs/roles.md](docs/roles.md).

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Dev server with `environment.ts` |
| `npm run build` | Production build with placeholder env (what CI runs) |
| `npm run build:prod` | Generates `environment.deploy.ts` from env vars, then builds with `production,deploy` (Vercel) |
| `npm run apk:debug` / `apk:release` | Android APK (deploy env, build, `cap sync`, Gradle) |
| `npm run lint` | ESLint (TS + templates, accessibility rules) |
| `npm test -- --watch=false` | Vitest unit tests (spec files isolated) |
| `npm run test:scripts` | Tests of `scripts/` (i18n keys, categories, env generation, APK helpers) |

- Edge Functions: `deno test --no-lock` in `supabase/functions/_shared`,
  `delete-account`, `recommend` and `suggest-promotions` (or with the
  `denoland/deno` Docker image).
- SQL security suites: `supabase/tests/local/run.sh` on a throwaway
  Postgres (Docker command in [docs/migrations.md](docs/migrations.md)).

## Project structure

```
src/app/
  core/           auth, Supabase client, config (AI mode), i18n, theme,
                  navigation, network status, native bridges (back button,
                  keyboard, haptics, status bar)
  shared/         account (types, guards, onboarding, owner paths), business
                  data and verification, orders, promotions (deals, card,
                  advisor), payments, notifications, media, map, forms, cart,
                  favourites, recommendations, geo, legal, layout, errors
  design-system/  base components (button, card, bottom sheet, tabs…)
  features/       one folder + lazy route per area: map, feed, promotions, ai,
                  cart, checkout, orders, notifications, favorites,
                  business-profile, owner (Luma Negocios), admin, auth,
                  onboarding, legal, profile, not-found
src/styles/       tokens, themes, motion, view transitions, map markers
supabase/         migrations, seeds, Edge Functions (+ _shared), SQL tests
scripts/          build-time scripts (environment, APK)
android/          Capacitor Android project
assets/           brand source for icon and splash
docs/             project documentation
```

Dependencies flow `features → shared → core`; features never import each
other. Details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tests and CI

GitHub Actions (`.github/workflows/ci.yml`) on every push and pull request:
`npm ci` → `npm audit --omit=dev --audit-level=high` → build → lint → unit
tests (verbose) → script tests. Dependabot opens weekly update PRs.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers, dependency rules, main flows
- [docs/roles.md](docs/roles.md) — permission matrix · [docs/verification.md](docs/verification.md) · [docs/admin.md](docs/admin.md)
- [docs/ai.md](docs/ai.md) — Luma IA, LLM gateway, free keys, deploy
- [docs/android.md](docs/android.md) — APK, JDK, signing, phone checklist
- [docs/deploy.md](docs/deploy.md) — Vercel, Supabase Auth, Edge Functions, CSP and headers
- [docs/migrations.md](docs/migrations.md) — migration order and status, SQL tests
- [docs/orders.md](docs/orders.md) — orders, prices and discounts, retention
- [docs/payments.md](docs/payments.md) — pay at pick-up and the Wompi plan
- [docs/mocks.md](docs/mocks.md) — client-side estimations and what is real
- [docs/legal-notes.md](docs/legal-notes.md) — what a person must review before launch
- [docs/auth-emails.md](docs/auth-emails.md) — email templates with codes
- [docs/security-notes.md](docs/security-notes.md) — dependency audit and accepted risks
- [docs/DECISIONS.md](docs/DECISIONS.md) — decisions taken and their alternatives
- [docs/WORKLOG.md](docs/WORKLOG.md) — what is done and what is left
- `.kiro/steering/` — product, tech, structure, security, design and conventions rules

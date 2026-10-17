# Luma

Mobile-first app to discover local restaurants and shops in Pasto (Nariño,
Colombia): an interactive map with live open/closed status, a vertical feed of
promotions and dishes with filters, the Luma IA recommender (rules-based
today), favourites, reviews, a cart, pick-up orders with time estimates and
in-app notifications, and a business panel where owners register their
business, manage hours, menu, photos and promotions, publish it and handle
incoming orders. Spanish UI by default, English as second language.

## Stack

| Area | Tech |
| --- | --- |
| Frontend | Angular 22 (standalone, Signals, `@if/@for`, OnPush, View Transitions) |
| Styles | Tailwind CSS v4 on design tokens (`src/styles/`), four themes |
| Data & auth | Supabase (Postgres + RLS, Auth, Storage, Edge Functions in Deno) |
| Map | MapLibre GL with OpenFreeMap tiles |
| i18n | Transloco (`public/i18n/es.json`, `en.json`) |
| Validation | Zod at the boundaries |
| Mobile | Capacitor (Android) |
| Tests | Vitest (app), `node:test` (scripts), Deno test (Edge Functions) |
| Hosting | Vercel (static build) |

## Requirements

- Node.js 24 and npm 11 (`packageManager` in `package.json`)
- A Supabase project (or the Supabase CLI for a local stack)
- Optional: Android Studio for the Capacitor app; Deno to test Edge Functions

## Getting started

```sh
npm ci
cp src/environments/environment.example.ts src/environments/environment.ts
# edit environment.ts with your Supabase URL and anon key (never commit it)
npm start            # http://localhost:4200
```

## Environment variables

| Where | Variable | Notes |
| --- | --- | --- |
| Local dev | `src/environments/environment.ts` | Gitignored. URL + **anon** key only. |
| Production build | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Read by `scripts/generate-env.mjs` (`npm run build:prod`); privileged keys are rejected. |
| Edge Function `delete-account` | `ALLOWED_ORIGINS` (comma-separated, exact; legacy `ALLOWED_ORIGIN` still read) | Supabase secret; `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase. |

The service-role key and any AI key live only in the backend.

## Database: migrations and seeds

Apply the migrations in `supabase/migrations/` **in filename (timestamp)
order**. [docs/migrations.md](docs/migrations.md) lists the exact order, what
each one does and its status (the orders, business panel, images, business
orders and notifications migrations are **pending review**, not applied).
Then the seeds:

Seeds (development data, 5 businesses in Pasto):

1. `supabase/seed.sql` — businesses, hours and promotions. Needs an
   `auth.users` row for the placeholder owner (see the file header).
2. `supabase/seed_menu_items.sql` — test menus, linked by business name;
   safe to run repeatedly.

Every table has Row Level Security; see the migrations for the policies.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Dev server with `environment.ts` |
| `npm run build` | Production build with placeholder env (what CI runs) |
| `npm run build:prod` | Generates the gitignored `environment.deploy.ts` from env vars, then builds with `production,deploy` (Vercel) |
| `npm run lint` | ESLint (TS + templates, accessibility rules) |
| `npm test -- --watch=false` | Vitest unit tests |
| `npm run test:scripts` | Tests of `scripts/`: i18n check (same keys in es/en, every literal key in `src/` exists) and business categories in sync with the database CHECK |
| `npx cap sync android` | Copies the web build into the Android project |

Edge Function tests: `cd supabase/functions/delete-account && deno test --no-lock`.
Database security tests: `supabase/tests/*.sql` (138 checks); run them on a
plain local Postgres with `supabase/tests/local/run.sh` (see
[docs/migrations.md](docs/migrations.md)).

## Project structure

```
src/app/
  core/           auth, Supabase client, i18n, theme, navigation, native bridges
  shared/         business data (repositories, write schemas), orders,
                  notifications, media (image upload), map base, forms,
                  cart, favourites, recommendations, geo, formatting, layout
  design-system/  base components (button, card, bottom sheet, tabs…)
  features/       one folder + lazy route per screen: map, feed, ai, cart,
                  checkout, orders, notifications, favorites, business-profile,
                  business-panel, profile, auth
src/styles/       tokens, themes, motion, view transitions, map markers
supabase/         migrations, seeds, Edge Functions, SQL security tests
scripts/          build-time scripts (environment generation)
docs/             project documentation
```

Dependencies flow `features → shared → core`; features never import each
other. Details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tests and CI

GitHub Actions (`.github/workflows/ci.yml`) on every push and pull request:
`npm ci` → `npm audit --omit=dev --audit-level=high` → build → lint → unit
tests → script tests. Dependabot opens weekly update PRs.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers, dependency rules, decisions
- [docs/deploy.md](docs/deploy.md) — Vercel, Supabase Auth URLs, CSP and headers
- [docs/ai.md](docs/ai.md) — Luma IA rules engine and the path to Claude
- [docs/migrations.md](docs/migrations.md) — migration order and status, constraint validation, SQL tests
- [docs/orders.md](docs/orders.md) — orders backend, retention, owners' board, manual status changes
- [docs/mocks.md](docs/mocks.md) — client-side estimations and what is real
- [docs/security-notes.md](docs/security-notes.md) — dependency audit and accepted risks
- [supabase/functions/delete-account/README.md](supabase/functions/delete-account/README.md)
- `.kiro/steering/` — product, tech, structure, security, design and conventions rules

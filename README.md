# Luma

Mobile-first app to discover local restaurants and shops in Pasto (Nariño,
Colombia): an interactive map with live open/closed status, a vertical feed of
promotions and dishes, the Luma IA recommender (rules-based today), favourites,
reviews, a cart and pick-up orders. Spanish UI by default, English as second
language.

## Stack

| Area | Tech |
| --- | --- |
| Frontend | Angular 22 (standalone, Signals, `@if/@for`, OnPush, View Transitions) |
| Styles | Tailwind CSS v4 on design tokens (`src/styles/`), four themes |
| Data & auth | Supabase (Postgres + RLS, Auth, Edge Functions in Deno) |
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
| Edge Function `delete-account` | `ALLOWED_ORIGIN` | Supabase secret; `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase. |

The service-role key and any AI key live only in the backend.

## Database: migrations and seeds

Apply the migrations in `supabase/migrations/` **in filename (timestamp)
order**, then the seeds:

1. `20240001000000_create_profiles.sql`
2. `20240002000000_create_businesses.sql`
3. `20261014000000_business_profile.sql` (menu, favourites, reviews)
4. `20261015000000_grant_existing_tables.sql`
5. Any later migration, in order.

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
| `npm run build:prod` | Generates `environment.prod.ts` from env vars, then builds (Vercel) |
| `npm run lint` | ESLint (TS + templates, accessibility rules) |
| `npm test -- --watch=false` | Vitest unit tests |
| `npm run test:scripts` | Tests of `scripts/` |
| `npx cap sync android` | Copies the web build into the Android project |

Edge Function tests: `cd supabase/functions/delete-account && deno test --no-lock`.

## Project structure

```
src/app/
  core/           auth, Supabase client, i18n, theme, navigation, native bridges
  shared/         business data (repositories, models), cart, favourites,
                  recommendations, geo, formatting, layout, UI helpers
  design-system/  base components (button, card, bottom sheet, tabs…)
  features/       one folder + lazy route per screen: map, feed, ai, cart,
                  checkout, orders, favorites, business-profile, profile, auth
src/styles/       tokens, themes, motion, view transitions, map markers
supabase/         migrations, seeds, Edge Functions, config
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
- [docs/mocks.md](docs/mocks.md) — client-side estimations and what is real
- [docs/security-notes.md](docs/security-notes.md) — dependency audit and accepted risks
- [supabase/functions/delete-account/README.md](supabase/functions/delete-account/README.md)
- `.kiro/steering/` — product, tech, structure, security, design and conventions rules

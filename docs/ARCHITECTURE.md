# Architecture

## Layers

```
features ──► shared ──► core
    │            │
    └──► design-system ◄┘
```

| Layer | Contains | May import |
| --- | --- | --- |
| `core/` | Singletons with no UI: auth session (`AuthService`, guards, `UserDataRegistry`), Supabase client, i18n, theme, route transitions, native bridges | Angular, third-party libs |
| `design-system/` | Base visual components and their variants, driven only by tokens | core (i18n pipe) |
| `shared/` | Reused domain code: repositories, models and write schemas (`business/data`, `orders`, `notifications`, `media`), map base, form helpers, cart, favourites, recommendations, geo, formatting, layout shell, UI directives | core, design-system |
| `features/` | One folder per screen with its own lazy route, page, components, component-scoped stores and pure utils | shared, core, design-system |

Rules (enforced in review; see `.kiro/steering/structure.md`):

- Dependencies only point down; **no feature imports another feature**.
- Data access only through repositories in `shared/` (`business/data`,
  `orders`, `notifications`, `media`), which return `RepoResult<T>` (`data` or a translation `errorKey`) and never throw
  raw Supabase errors at the UI.
- Business logic lives in stores/services and pure functions (`utils/`),
  never in templates.
- Writes are validated with zod/mini schemas that mirror the database CHECK
  constraints (`shared/business/data/business-write.schemas.ts`); the
  closed category list is kept in sync with its CHECK by a script test.
- Global state only for the session (auth) and theme; the unread
  notifications count is provided by the tab layout, not the root; per-user caches
  (favourites, cart) register in `UserDataRegistry` and are wiped on sign-out
  or account deletion.
- Batched reads: lists of businesses fetch related rows with one `in` query
  per table, never one request per business.

## Data flow

```
Page (OnPush) ─► feature store (signals, providedIn: component)
                   ─► shared repositories ─► Supabase (RLS)
                   ─► pure utils (status, feed cards, cart review, scoring)
```

Server-side rules that the client must not be trusted with (prices, order
creation, status changes, account deletion) live in Postgres functions or
Edge Functions.

## Key decisions

| Decision | Why |
| --- | --- |
| Signals + component-provided stores, no global store library | Small surface, OnPush-friendly, state dies with the screen |
| Tailwind v4 on CSS-variable tokens, default palette disabled | One place to change colours; four themes with the same token structure |
| Motion with CSS + View Transitions, no animation library | Only transform/opacity animate; respects reduced motion; no bundle cost |
| Recommendations behind `RecommendationEngine` | Rules today, Claude via Edge Function later without touching callers (`docs/ai.md`) |
| Client cart, server prices | The cart is informative; `create_order` recalculates every total (`docs/orders.md`) |
| `delete-account` Edge Function | Only the service role can delete `auth.users`; identity comes from the JWT only |
| Static hosting with strict CSP | No server code in the web tier; `docs/deploy.md` lists the two justified relaxations |
| Capacitor for Android | Same codebase as the web app |
| Business panel as one lazy feature behind `authGuard` | Owners only ever touch their rows: RLS on every table, a publish guard trigger, Storage paths scoped to their business |
| Owners read orders through security-barrier views | The orders RLS stays customer-only; the views drop `user_id` and email and show only a public display name |
| Notifications written by triggers, text built by the app | Clients never insert; nothing user-written is stored or translated server-side |
| Images re-encoded on a canvas before upload | Resizes to 1280 px and drops EXIF (GPS) without a server step; the bucket still enforces 2 MB and image types |
| New CHECK constraints added NOT VALID | Existing rows never block a migration; `docs/migrations.md` shows how to validate them |

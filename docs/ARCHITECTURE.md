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
| `shared/` | Reused domain code: repositories and models (`business/data`), cart, favourites, recommendations, geo, formatting, layout shell, UI directives | core, design-system |
| `features/` | One folder per screen with its own lazy route, page, components, component-scoped stores and pure utils | shared, core, design-system |

Rules (enforced in review; see `.kiro/steering/structure.md`):

- Dependencies only point down; **no feature imports another feature**.
- Data access only through repositories in `shared/business/data`, which
  return `RepoResult<T>` (`data` or a translation `errorKey`) and never throw
  raw Supabase errors at the UI.
- Business logic lives in stores/services and pure functions (`utils/`),
  never in templates.
- Global state only for the session (auth) and theme; per-user caches
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

# Architecture

## Layers

```
features ──► shared ──► core
    │            │
    └──► design-system ◄┘
```

| Layer | Contains | May import |
| --- | --- | --- |
| `core/` | Singletons with no UI: auth session (`AuthService`, `AuthCodeService`, guards, `UserDataRegistry`), Supabase client, config (`AI_MODE`, environment check), network status, i18n, theme, route transitions, native bridges (back button, keyboard, haptics, status bar) | Angular, third-party libs |
| `design-system/` | Base visual components and their variants, driven only by tokens | core (i18n pipe) |
| `shared/` | Reused domain code: account (types, session profile, guards, onboarding, owner paths, account actions), business data, domain value objects (`Nit`, `OpeningHours`) and verification, orders, promotions (deals, card, advisor), payments, notifications, media, map base, form helpers, cart, favourites, recommendations, geo, legal version, formatting, layout shells and notices, error handler | core, design-system |
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

## Contracts behind interfaces

Swappable pieces are contracts with an implementation chosen by an
InjectionToken or an abstract class with a Supabase implementation:

| Contract | Implementations |
| --- | --- |
| `RecommendationEngine` | rules (default), remote + rules fallback |
| `PromotionAdvisor` | rules (owner sales aggregates), remote + rules fallback |
| `PaymentGateway` | pay at pick-up (Wompi planned, `docs/payments.md`) |
| Repositories (`AccountProfileRepository`, `VerificationRepository`, `PromotionDealRepository`...) | Supabase |
| `LlmProvider` (Edge Functions) | Gemini, OpenAI-compatible, Anthropic |

Value objects (`Phone`, `AccountType`, `Nit`, `OpeningHours`) validate once
and are immutable; the opening-hours rule is shared with SQL through common
test cases.

## Accounts and shells

- Sign-up in 4 steps with metadata read by `handle_new_user`; codes instead
  of links; tutorial `/welcome` once per version.
- Customers land on `/map` (customer tab layout); business owners on
  `/owner` (Luma Negocios shell with its own tabs, one business per URL);
  admins also reach `/admin`. Public: `/auth/*`, `/legal/*`.
- Unknown URLs open a 404 page; unhandled errors show a notice
  (`AppErrorHandler`); an app-wide notice tells offline from service
  failures.

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
| Luma IA behind contracts, rules by default | Works with no external service; the remote mode adds an LLM through Edge Functions and falls back to the rules (`docs/ai.md`) |
| LLM output limited to ids and codes | Prompt injection in business texts cannot reach users; prices are always recomputed by the server |
| Promotion discounts priced in `create_order` | The client never sets a price; one rounding rule in SQL, mirrored for display |
| Verification before public visibility | `is_business_public` (published and approved) in every public policy, view, Storage read and `create_order` |
| Client cart, server prices | The cart is informative; `create_order` recalculates every total (`docs/orders.md`) |
| `delete-account` Edge Function | Only the service role can delete `auth.users`; identity comes from the JWT only |
| Static hosting with strict CSP | No server code in the web tier; `docs/deploy.md` lists the two justified relaxations |
| Capacitor for Android | Same codebase as the web app |
| Luma Negocios as one lazy feature (`features/owner`) behind `ownerGuard` | Owners only ever touch their rows: RLS on every table, a publish guard trigger, Storage paths scoped to their business |
| Spec files isolated in Vitest | `vi.mock` of shared modules stays reliable whatever the worker split (`docs/DECISIONS.md`) |
| Owners read orders through security-barrier views | The orders RLS stays customer-only; the views drop `user_id` and email and show only a public display name |
| Notifications written by triggers, text built by the app | Clients never insert; nothing user-written is stored or translated server-side |
| Images re-encoded on a canvas before upload | Resizes to 1280 px and drops EXIF (GPS) without a server step; the bucket still enforces 2 MB and image types |
| New CHECK constraints added NOT VALID | Existing rows never block a migration; `docs/migrations.md` shows how to validate them |

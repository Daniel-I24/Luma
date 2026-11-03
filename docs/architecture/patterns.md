# Patterns and rules of the code

Where each design pattern lives, and the rules that keep the code that way.
Paths are relative to `src/app/` unless they start with `supabase/`.

## Layers

```
features/*  ─▶  shared/  ─▶  core/
     │             │
     └──────▶ design-system/ ─▶ core/
```

- `core/`: app-wide singletons with no UI of their own (auth, config,
  native bridges, push, startup, theme, update).
- `design-system/`: base visual components (`app-luma-*`), styled only with
  tokens; features never re-style them.
- `shared/`: domain models, repositories and components used by more than
  one feature.
- `features/*`: one lazy route each (README in every folder); a feature
  never imports another feature.

Enforced by `luma/layer-boundaries` (eslint/layers.js), which resolves
aliases and relative paths.

## Patterns

| Pattern | Where | Why |
| --- | --- | --- |
| Repository | `shared/**/*.repository.ts` (`AccountProfileRepository`, `AdminRepository`, `ReportRepository`, `VerificationRepository`, `PlaceSearchRepository`, `PromotionDealRepository`: one injectable class each, mocked in tests by provider); `supabase/functions/_shared/payments/payment-repository.ts` | Data access in one place; raw Supabase errors are mapped to translation keys there |
| Strategy | `shared/payments/payment-gateway.ts` (`PayAtPickupGateway`, `WompiGateway`); `shared/recommendations/recommendation-engine.ts` (`RulesRecommendationEngine`, `RemoteRecommendationEngine`); `shared/promotions/advisor/promotion-advisor.ts` (rules and remote advisors) | Swap behaviour by configuration (`AI_MODE`, payment method) without `if` chains |
| Factory | `PaymentGatewayFactory` (`shared/payments/payment-gateway.ts`); `MapMarkerFactory` (`features/map/services/map-marker.factory.ts`); `MerchantCredentialsFactory` (`supabase/functions/_shared/payments/merchant-credentials.ts`) | Build the right object for a method, status or environment |
| Adapter | `core/native/native-actions.ts` (`ExternalBrowser`, `NativeHaptics`), `core/push/push-platform.ts` (`PushPlatform`), `transloco-loader.ts`, `shared/geo/place-search.repository.ts` (`PlaceSearchRepository`), `supabase/functions/_shared/payments/wompi-api.ts` | Plugins and remote APIs behind app-shaped interfaces, replaceable in tests |
| Builder | `shared/recommendations/combo-builder.ts` (`ComboBuilder`); `supabase/functions/_shared/payments/checkout-url-builder.ts` | Assemble a combo or a signed checkout URL step by step |
| State machine | `supabase/functions/_shared/payments/payment-state-machine.ts` and SQL `payment_transition_allowed` (shared vectors in `supabase/tests/fixtures/payment_transitions.json`); `features/owner/utils/order-board.ts` (allowed order actions per status) | Only valid transitions are possible, checked the same way in SQL and TypeScript |
| Chain of responsibility | `supabase/functions/_shared/payments/payment-event-verifier.ts` | Each check (shape, checksum, idempotency, API confirmation, amounts) can stop a Wompi event |
| Facade | `shared/cart/cart-actions.service.ts` (cart, toasts, haptics, replace dialog), `core/auth/auth.service.ts`, `core/startup/app-entry.ts` | One call for a screen action that touches several services |
| Decorator | `FallbackRecommendationEngine` (`shared/recommendations/remote-recommendation.engine.ts`), `FallbackPromotionAdvisor` | Wrap a strategy with a fallback without changing it |
| Observer (signals) | every `*.store.ts` (private `signal`, public `asReadonly()`/`computed`), `effect` in pages, `core/network/connectivity.service.ts` | Reactive state with OnPush components |
| InjectionToken | `AI_MODE` (`core/config/build-flags.ts`), `PUSH_ENABLED` (`core/push`), `UPDATE_SITE_URL` (`core/update`), `PAGE_LOCATION`, `IMAGE_ENCODER`, `PROMOTION_ADVISOR`, `RECOMMENDATION_ENGINE` | Configuration and replaceable browser APIs, injected instead of imported |
| Value object | `shared/account/phone.ts`, `shared/account/account-type.ts`, `shared/business/domain/nit.ts`, `shared/business/domain/opening-hours.ts`, `shared/geo/residence.ts`, `supabase/functions/_shared/payments/money.ts` | Validated, immutable domain values with equality |

## Data structures

- `Map` and `Set` for lookups by id (`rank`, `byId`, `dishDiscount`,
  hours cache, user-data registry, promoted items) instead of nested
  `find` loops.
- No shared mutable state: stores keep private signals and expose readonly
  views; static helper classes are stateless.
- Inheritance only for real duplication (abstract repositories with one
  Supabase implementation, `ExternalBrowser`, `PushPlatform`); otherwise
  composition through `inject()`.

## Rules (CI: `npx ng lint`)

Since round 3 only `no-explicit-any`, `naming-convention` and `max-lines`
(150) are errors; every other rule below is a warning. Warnings are kept
at zero by convention (Definition of Done: no new warnings).

| Rule | Limit |
| --- | --- |
| `complexity` | 10 |
| `max-lines-per-function` | 40 (no blank lines or comments) |
| `max-lines` | 150 per file |
| `max-depth` | 3 |
| `@typescript-eslint/max-params` | 4 |
| `@typescript-eslint/no-magic-numbers` | only 0, 1, -1; constants in `core/config/units.ts`, `core/config/http-status.ts` or named next to their use; data tables carry a justified disable |
| `explicit-member-accessibility`, `explicit-function-return-type`, `prefer-readonly`, `no-explicit-any` | always |
| `naming-convention` (eslint/naming.js) | camelCase members, PascalCase types, UPPER_SNAKE constants |
| `luma/layer-boundaries` | features → shared → core, no feature-to-feature imports |
| `luma/no-loose-functions` | no exported free functions; only Angular `*Fn` factories and `provide*` |
| `luma/require-jsdoc` | JSDoc on every class and public method (`@inheritdoc` for implementations) |

Specs relax size, literal and documentation limits; types and layers still
apply. The local rules are tested in `scripts/eslint-rules.test.mjs`.

## Exceptions

- Angular functional factories stay functions (`*Fn` guards, resolvers,
  interceptors, `provide*`), as thin adapters that delegate to classes.
- Data tables (DIAN weights, option lists, encoder qualities) keep literal
  numbers with a justified `eslint-disable-next-line`.
- Module-private helpers (not exported) may be plain functions or arrows
  next to the class that uses them.
- Edge Functions (`supabase/functions`) follow Deno conventions and are not
  covered by these ESLint rules; their own tests and `deno check` apply.

## Naming

Files in kebab-case with a type suffix (`.page.ts`, `.store.ts`,
`.repository.ts`, `.service.ts`, `.guard.ts`, `.routes.ts`, `.pipe.ts`,
`.directive.ts`, `.model.ts`, `.schema(s).ts`); plain names for value
objects and helper classes (`phone.ts`, `order-board.ts`). No `.util.ts`
files: helpers are classes with static methods.

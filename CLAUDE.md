# Luma

Mobile-first app for discovering local restaurants and shops (interactive map + vertical feed + AI recommender, orders and payments).
Stack: Angular 22 (standalone, Signals, `@if/@for`, OnPush) + Tailwind v4 + Supabase + Capacitor + MapLibre GL + Transloco + Zod + Vitest.

The full project rules live in `.kiro/steering/` (`product`, `tech`, `structure`, `security`, `design-tokens`, `conventions`). Read them before working; this file is a summary.

## Language
- Code, file names, identifiers, comments, tests and commits in English (Conventional Commits).
- User interface in Spanish by default, English as second language, via Transloco (`public/i18n/es.json`, `public/i18n/en.json`).
- No user-visible text hard-coded in templates or TS: always a translation key.
- Every translation key used in code must exist in both `es.json` and `en.json`, and both files must have exactly the same keys.

## Code quality
- Strict TypeScript: no `any` (use `unknown` + Zod at boundaries), no `console.log`, no dead code, no secrets.
- Object orientation and good practices: one responsibility per class/service, dependency injection with `inject()`, composition over inheritance, encapsulation (private state, readonly public signals).
- Typed errors: never let raw Supabase errors reach the UI; map them to domain errors with a translation key.
- Explicit error handling in every public function; never swallow exceptions.
- Business logic in services/facades, data access only through repositories, no business logic in templates.
- Max 150 lines per file; if a file grows beyond that, split it.

## Architecture
- `src/app/{core,shared,design-system,features}`. Dependencies flow `features → shared → core`; no feature imports from another feature.
- Each feature is self-contained with its own lazy route.
- Every route used in code (`routerLink`, `router.navigate`, guards) must exist in `app.routes.ts` (or the lazy routes it loads).
- State: Signals + per-feature services; global state only for session and theme.

## Design
- Components only use design tokens through Tailwind utilities (`bg-surface`, `text-fg-muted`, `bg-status-open`) or `var()`; never literal colors or sizes. The default Tailwind palette is disabled.
- Simulated data lives only in `src/app/shared/mock/` behind a typed interface and is listed in `docs/mocks.md`.
- Base visual elements live once in `design-system/`; features never re-style them.
- Themes: Indigo (default), Midnight, Pearl, Sunset — same token structure.
- Touch targets ≥ 44px, AA contrast, respect `prefers-reduced-motion`, skeletons instead of spinners.

## Security
- RLS on every table; only the `anon` key in the client; `service_role` and AI keys only in the backend.
- The app never handles card data (Wompi hosted checkout/tokenization); prices are computed server-side.
- Never read, modify or commit `src/environments/environment.ts` (real keys, gitignored).

## Verification after every change
```
npm run build
npx ng lint
npm test -- --watch=false
npm run test:scripts
```

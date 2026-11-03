# Deploy

The web app is a static Angular build hosted on Vercel; data, auth and Edge
Functions live in Supabase. Nothing here deploys anything by itself.

## Vercel

1. Import the GitHub repository in Vercel (framework preset: **Other**).
2. `vercel.json` already sets:
   - Build command: `npm run build:prod`
   - Output directory: `dist/luma/browser`
   - SPA rewrite of every path to `/index.html` (static files win first).
3. Environment variables (Production and Preview):

   | Variable | Value |
   | --- | --- |
   | `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `SUPABASE_ANON_KEY` | the **anon / publishable** key |

   `scripts/generate-env.mjs` writes `src/environments/environment.deploy.ts`
   (gitignored) from them, then `ng build --configuration production,deploy`
   runs: the `deploy` configuration in `angular.json` only adds the
   `fileReplacements` entry `environment.ts → environment.deploy.ts`. The
   script fails the build when a variable is missing, when the URL is not
   https, or when the key is privileged (`sb_secret_…` or a JWT whose `role`
   is `service_role`). It never prints the key.
4. Node 24 (same as CI).

`environment.prod.ts` stays committed with placeholders and is never
rewritten, so CI (`npm run build`, plain production configuration) and local
builds keep compiling. Running `npm run build:prod` locally leaves no change
to commit.

## Supabase Auth

Accounts are confirmed and passwords reset with emailed 6-digit codes, never
with links: paste the templates in [docs/auth-emails.md](auth-emails.md) and
configure your own SMTP before real users sign up. The **Site URL**
(Authentication → URL Configuration) can be `https://<your-domain>`; no
redirect URL is needed for these flows.

## Edge Functions

Ten functions; shared code lives in `supabase/functions/_shared` (payments: `_shared/payments`, provider URLs: `_shared/config`). All of
them work without their optional secrets: they answer `ai_unavailable`,
`geocode_unavailable` or `push_unavailable` and the app falls back.

| Function | Called by | JWT | Needs | Without it |
| --- | --- | --- | --- | --- |
| `delete-account` | app (Profile) | yes | service role (automatic) | account deletion fails |
| `recommend` | app, AI_MODE remote | yes | `LLM_*` secrets | app uses its rules |
| `suggest-promotions` | app, AI_MODE remote | yes | `LLM_*` secrets | answers the rules (200) |
| `extract-menu` | app, AI_MODE remote | yes | `LLM_*` (+ `LLM_VISION_MODEL`) | scan unavailable; manual menu |
| `geocode` | app (map search) | yes | `GEOCODE_PROVIDER` (+ key/contact) | businesses-only search |
| `push-dispatch` | the database (pg_net, pg_cron) | **no** (shared secret) | `FCM_SERVICE_ACCOUNT`, `PUSH_DISPATCH_SECRET` | in-app notifications only |
| `create-payment` | app (checkout, online payment) | yes | `WOMPI_*` | `payments_unavailable`; pay at pick-up still works |
| `wompi-webhook` | Wompi | **no** (event checksum) | `WOMPI_*` | every event rejected; Wompi retries |
| `reconcile-payments` | pg_cron, admins | **no** (secret or admin JWT) | `WOMPI_*`, `PAYMENTS_CRON_SECRET` | the webhook alone settles payments |
| `void-payment` | admin panel | yes | `WOMPI_*` | refunds by hand in the Wompi dashboard |

`ALLOWED_ORIGINS` is a comma-separated list of browser origins, matched
exactly (no wildcards; empty entries are ignored). The legacy single
`ALLOWED_ORIGIN` is still accepted and merged in. Nothing is allowed by
default.

| Origin | When |
| --- | --- |
| `https://localhost` | Always: Capacitor Android WebView |
| `https://<vercel-domain>` | Always: the production web app |
| `http://localhost:4200` | Development Supabase project only (`ng serve`) |

```sh
supabase secrets set ALLOWED_ORIGINS=https://localhost,https://<vercel-domain>
```

Deploy each function with its JWT flag. The flag must match
`supabase/config.toml` (`verify_jwt`), which `scripts/db-drift.test.mjs`
keeps in sync with the folders. Functions called with a user session keep
the gateway JWT check **on** (no flag); functions called by the database or
by a payment provider have it **off** and authenticate each request with a
shared secret or a signature instead.

| Function | Command | `verify_jwt` | Authenticated by |
| --- | --- | --- | --- |
| `delete-account` | `supabase functions deploy delete-account` | true | user JWT |
| `geocode` | `supabase functions deploy geocode` | true | user JWT (docs/geocode.md for its secrets) |
| `recommend` | `supabase functions deploy recommend` | true | user JWT (docs/ai.md) |
| `suggest-promotions` | `supabase functions deploy suggest-promotions` | true | user JWT (docs/ai.md) |
| `extract-menu` | `supabase functions deploy extract-menu` | true | user JWT (docs/ai.md) |
| `push-dispatch` | `supabase functions deploy push-dispatch --no-verify-jwt` | **false** | `x-push-secret` (`PUSH_DISPATCH_SECRET`, docs/push.md) |
| `create-payment` | `supabase functions deploy create-payment` | true | customer JWT (docs/payments.md) |
| `wompi-webhook` | `supabase functions deploy wompi-webhook --no-verify-jwt` | **false** | Wompi event checksum (`WOMPI_EVENTS_SECRET`) |
| `reconcile-payments` | `supabase functions deploy reconcile-payments --no-verify-jwt` | **false** | `x-cron-secret` (`PAYMENTS_CRON_SECRET`) or an admin JWT with aal2, checked in the function |
| `void-payment` | `supabase functions deploy void-payment` | true | admin JWT with aal2 |

Never deploy a JWT function with `--no-verify-jwt`: the function code
checks the session too, but the gateway check is the first line of
defence. Never deploy `push-dispatch` without the flag either: the
database pokes it without a user JWT, so every poke would be refused.

Then check everything with `npm run verify:backend` (anon key only).

Vercel preview URLs are not covered (no wildcards); add a preview origin
explicitly if you need to test these functions there.

## Storage

Migration `20261018000100_business_images.sql` creates the public
`business-images` bucket (2 MB, JPEG/PNG/WebP) and its policies; nothing has
to be configured by hand. Pictures are public https URLs, already allowed by
`img-src https:` in the CSP. Migration
`20261020000400_verification_storage.sql` creates the **private**
`verification-docs` bucket (5 MB, images and PDF) read by the owner and, with
60-second signed URLs, by admins. `delete-account` removes both a user's
business pictures and verification documents before deleting the account.

## Android

The APK bundles the same build (`npm run apk:debug` / `apk:release`):
[android.md](android.md). Add `https://localhost` to `ALLOWED_ORIGINS`.

## Caching

| Files | Cache-Control |
| --- | --- |
| `main-*.js`, `chunk-*.js`, `polyfills-*.js`, `styles-*.css`, `media/*` (content-hashed) | `public, max-age=31536000, immutable` |
| Everything else: `index.html`, SPA routes, `i18n/*.json`, `maplibre-gl-worker.mjs`, `map.css`, `favicon.ico`, `robots.txt` | `no-cache` (revalidate every time) |

`index.html` preloads `i18n/es.json` (the default language), which the
first paint needs.

## Security headers

Sent on every response (`vercel.json`):

- `Content-Security-Policy`:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:; font-src 'self';
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://tiles.openfreemap.org;
  worker-src 'self' blob:; manifest-src 'self'; object-src 'none';
  base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(self), camera=(), microphone=()`

### Where the CSP is relaxed, and why

- **`style-src 'unsafe-inline'`**: Angular injects each component's styles as
  `<style>` elements at runtime. Without it the app loses its component
  styles (verified: 7 `style-src-elem` violations). A nonce would avoid it,
  but a static host cannot generate one per request. Scripts stay strict:
  `script-src 'self'` with no inline script.
- **Critical CSS inlining is off** (`angular.json` → production →
  `optimization.styles.inlineCritical: false`). Angular's inliner adds an
  inline `<script>` that swaps the stylesheet's media; `script-src 'self'`
  would block it and leave the stylesheet on `media="print"`.
- **`worker-src 'self'`** (besides `blob:`): MapLibre's worker is the
  same-origin file `maplibre-gl-worker.mjs`; without `'self'` the map
  cannot start its worker (verified).
- **`img-src https:`**: logos, covers and menu photos are https URLs
  (Supabase Storage today; owners may use other hosts). The database only
  accepts https image URLs.

### Verified (production build, headless Edge, CSP active)

Login, redirect to the map, MapLibre canvas with tiles from
`tiles.openfreemap.org`, markers, theme change and language change work with
zero CSP violations (verified on the 2026-10-17 build). In production
`/design-preview` does not exist and opens the 404 page.

## Production-only behaviour

- `/design-preview` (design-system showcase) exists only in development
  builds; production drops the route and unknown URLs open the 404 page.

## Audits (2026-10-17, production build)

**Accessibility (axe-core 4.14, WCAG 2.0–2.2 A/AA)** on map, map filters
sheet, feed, Luma IA, business profile, favourites, cart → checkout, orders,
order detail, profile, notifications, login and every business panel screen,
in the four themes: **0 serious or critical issues**. Fixed in this pass:
MapLibre's attribution toggle was covered by the map controls and the
location prompt (moved to bottom-left; the prompt sits above it).

**Lighthouse 12 (mobile, simulated throttling)** on `/auth/login` (the only
screen reachable without a session; Vercel-like headers and compression):

| Category | Before | After |
| --- | --- | --- |
| Performance | 82 | 86–87 |
| Accessibility | 100 | 100 |
| Best practices | 100 | 100 |
| SEO | 82 | 100 |

Fixed: meta description, a valid `robots.txt`, preload of `i18n/es.json`.
Left as is (not cheap):

- FCP 2.7 s / LCP 3.3 s on slow 4G: initial bundle ~150 KB transferred
  (Angular, Supabase client, Transloco).
- Render-blocking `styles.css` (~230 ms): critical CSS inlining is off
  because it needs an inline script that the CSP blocks (see above).
- ~70 KB of unused JavaScript in the initial chunk (Supabase client parts not
  used at start-up); would need deferring the client or lighter auth calls.
- No production source maps (deliberate).

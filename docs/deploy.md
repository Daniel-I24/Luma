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

## Supabase Auth URLs

Authentication → URL Configuration:

- **Site URL**: `https://<your-domain>`
- **Redirect URLs**:
  - `https://<your-domain>/**`
  - `https://*-<team>.vercel.app/**` (preview deployments, if used)
  - `http://localhost:4200/**` (local development)
  - `https://localhost/**` (Capacitor Android WebView origin)

## delete-account Edge Function

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
supabase functions deploy delete-account
```

Vercel preview URLs are not covered (no wildcards); add a preview origin
explicitly if you need to test account deletion there.

## Storage (business pictures)

Migration `20261018000100_business_images.sql` creates the public
`business-images` bucket (2 MB, JPEG/PNG/WebP) and its policies; nothing has
to be configured by hand. Pictures are public https URLs, already allowed by
`img-src https:` in the CSP. `delete-account` removes a user's business
pictures before deleting the account.

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
zero CSP violations; `/design-preview` redirects to `/map` in production.

## Production-only behaviour

- `/design-preview` (design-system showcase) exists only in development
  builds; production drops the route and unknown URLs go to `/map`.

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

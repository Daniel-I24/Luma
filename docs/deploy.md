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

   `scripts/generate-env.mjs` writes `src/environments/environment.prod.ts`
   from them before `ng build`. It fails the build when a variable is missing,
   when the URL is not https, or when the key is privileged (`sb_secret_…` or
   a JWT whose `role` is `service_role`). It never prints the key.
4. Node 24 (same as CI).

`environment.prod.ts` is committed with placeholders so CI and local builds
work. If you run `npm run build:prod` locally, restore it afterwards
(`git checkout src/environments/environment.prod.ts`) instead of committing
it.

## Supabase Auth URLs

Authentication → URL Configuration:

- **Site URL**: `https://<your-domain>`
- **Redirect URLs**:
  - `https://<your-domain>/**`
  - `https://*-<team>.vercel.app/**` (preview deployments, if used)
  - `http://localhost:4200/**` (local development)
  - `https://localhost/**` (Capacitor Android WebView origin)

## delete-account Edge Function

Set the production web origin as its only configurable origin:

```sh
supabase secrets set ALLOWED_ORIGIN=https://<your-domain>
supabase functions deploy delete-account
```

`http://localhost:4200` is always allowed. The Android app runs on the
Capacitor origin `https://localhost`, which is **not** allowed today (the
function accepts one configurable origin), so deleting the account from the
Android build fails CORS until the function accepts a list of origins.

## Caching

| Files | Cache-Control |
| --- | --- |
| `main-*.js`, `chunk-*.js`, `polyfills-*.js`, `styles-*.css`, `media/*` (content-hashed) | `public, max-age=31536000, immutable` |
| Everything else: `index.html`, SPA routes, `i18n/*.json`, `maplibre-gl-worker.mjs`, `map.css`, `favicon.ico` | `no-cache` (revalidate every time) |

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

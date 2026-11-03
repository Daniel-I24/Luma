# Map search of places (geocode)

The map search finds businesses (local, in the app) and also neighbourhoods,
addresses and places through the `geocode` Edge Function, which hides the
provider key and enforces quotas and caching.

## Function

- POST, JWT (any signed-in user; an unconfirmed email may still search).
- Body `{ q, near? }`: `q` 2 to 120 characters; `near` `{ lat, lng }` is
  optional, rounded to 2 decimals (about 1 km) before reaching the provider
  and ignored outside Colombia (then Pasto is the bias).
- Answer `{ places: [{ label, kind, lat, lng }] }`, at most 8, kinds
  `address | street | neighbourhood | city | poi`, coordinates inside
  Colombia only, labels plain text.
- Errors: 400 `invalid_request`, 401, 429 `quota_exceeded`, 503
  `geocode_unavailable` (no provider configured or provider down). The app
  then shows business results only and a short notice.
- Cache: `ai_cache`, key `geocode:<sha256(provider, query, bias)>`, 7 days.
  The quota (`consume_geocode_quota`: `geocode_daily_per_user` 200,
  `geocode_daily_global` 5000) is spent only on cache misses.

## Providers (secrets only)

| `GEOCODE_PROVIDER` | Other secrets | Usage policy to respect |
| --- | --- | --- |
| `photon` | none | photon.komoot.io: fair use, no heavy traffic; fine for launch volume |
| `nominatim` | `GEOCODE_CONTACT` (email or URL, sent in the User-Agent) | max 1 request/s, identifying User-Agent, caching, no search-as-you-type; tests and very low volume only |
| `locationiq` | `GEOCODE_API_KEY` | free plan daily/second limits; attribution to OpenStreetMap |
| `maptiler` | `GEOCODE_API_KEY` | free plan monthly limit; MapTiler and OpenStreetMap attribution |

All requests are restricted to Colombia (`countrycodes=co`, `country=co` or
the Colombia bbox, plus a server-side country check), in Spanish where the
provider supports it, and biased to Nariño and Pasto. Results come from
OpenStreetMap data: the map already shows the © OpenStreetMap attribution.

The app calls `geocode` only when the user submits the search (Enter or the
search button), never on every keystroke, which also satisfies Nominatim's
no-autocomplete rule. Business results update while typing.

## Deploying (manual)

```sh
supabase secrets set GEOCODE_PROVIDER=photon
# or: GEOCODE_PROVIDER=maptiler GEOCODE_API_KEY=<key>
supabase functions deploy geocode
```

Apply migration `20261026000000_geocode_quota.sql` first.

## Tests

`deno test --no-lock --config deno.json -A` in `supabase/functions/geocode`
(fake fetch: request parameters of each provider, Colombia filter, labels,
cache before quota, errors) and `supabase/tests/geocode_quota.sql`.

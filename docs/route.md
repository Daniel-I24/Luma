# Route ("Cómo llegar" inside the app)

`RouteMap` (`shared/route/route-map`) draws the way from the customer to
the business on Luma's own map, on the business screen (Información) and on
the order screen, with distance and time, walking or by car, and keeps
"Abrir en Google Maps" as a secondary link.

## Edge Function `route`

- `verify_jwt = true`; the handler checks the JWT again and the CORS allow list.
- Body `{ from: {lat, lng}, to: {lat, lng}, mode: 'walk' | 'drive' }`;
  positions rounded to 4 decimals (about 11 m), at most 200 km apart.
- Cache: `ai_cache` (`route:<sha256>`), one day.
- Quota: `hit_rate_limit('route')`, 60 provider calls a day per user
  (`rate_route_*` in `app_settings`, migration 52); cached answers are free.
- `RoutingProvider` interface; OpenRouteService implementation (Directions
  V2 GeoJSON, key in the Authorization header, 6 s timeout).
- Without `ROUTE_API_KEY`, when the provider fails or the quota is used: a
  straight line, distance times 1.3 and an average speed (4.8 km/h walking,
  25 km/h by car). The app computes the same estimate when the function is
  not deployed or the phone is offline.

## Secrets

```sh
supabase secrets set ROUTE_PROVIDER=openrouteservice ROUTE_API_KEY=<key from account.heigit.org>
supabase functions deploy route
```

OpenRouteService (HeiGIT documentation, checked 2026-10-28): Directions
default limit of 2000 requests a day and 40 a minute; "an API key must not
be used client-side". The plans page did not load when checked: confirm the
current free plan and its terms (commercial use, attribution) in the HeiGIT
dashboard before enabling it.

## Tests

`supabase/functions/route/handler.test.ts` (fetch simulated, no network),
`src/app/shared/route/route.repository.spec.ts`.

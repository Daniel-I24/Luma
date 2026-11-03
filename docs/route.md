# Route ("Cómo llegar" inside the app)

`RouteMap` (`shared/route/route-map`) draws the way from the customer to
the business on Luma's own map, on the business screen (Información) and on
the order screen, with distance and time, and keeps "Abrir en Google Maps" as
a secondary link.

## Travel modes (round 7)

Icon buttons with an accessible name and a tooltip; the chosen one shows its
name and is remembered on the device (`luma.route.mode`, DeviceStorage).

| Mode | Icon | OpenRouteService profile | Time | Straight-line speed |
| --- | --- | --- | --- | --- |
| A pie (`walk`) | Lucide `footprints` | `foot-walking` | as answered | 4.8 km/h |
| Bicicleta (`bike`) | Lucide `bike` | `cycling-regular` | as answered | 15 km/h |
| Moto (`moto`) | Luma's own drawing | `driving-car` | × 0.8, "Tiempo aproximado" | 30 km/h |
| Carro (`drive`) | Lucide `car` | `driving-car` | as answered | 25 km/h |

The straight line multiplies the distance by 1.3 (streets are longer). The
profiles live in `supabase/functions/route/profiles.ts` and
`src/app/shared/route/travel-modes.ts` (kept in step; tests on both sides).

## Edge Function `route`

- `verify_jwt = true`; the handler checks the JWT again and the CORS allow list.
- Body `{ from: {lat, lng}, to: {lat, lng}, mode: 'walk' | 'bike' | 'moto' | 'drive' }`;
  positions rounded to 4 decimals (about 11 m), at most 200 km apart.
- Cache: `ai_cache` (`route:<sha256>`), one day.
- Quota: `hit_rate_limit('route')`, 60 provider calls a day per user
  (`rate_route_*` in `app_settings`, migration 52); cached answers are free.
- `RoutingProvider` interface; OpenRouteService implementation (Directions
  V2 GeoJSON, key in the Authorization header, 6 s timeout).
- Without `ROUTE_API_KEY`, when the provider fails or the quota is used: a
  straight line, distance times 1.3 and the average speed of the mode (table
  above). The app computes the same estimate when the function is
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

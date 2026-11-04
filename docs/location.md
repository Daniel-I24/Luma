# Business location (LocationPicker)

Where a business is matters more than anything else on its profile: the map,
the distance in the feed, the route of "Cómo llegar" and the pick-up of every
order use it. The owner sets it in Mi negocio → Información (and in the
registration) with these parts:

| Part | File | What it is for |
| --- | --- | --- |
| Municipality (DANE) | `shared/geo/residence-picker` | Chosen first: its centre (the DANE list, `public/data/dane-municipalities.json`) starts the map, bounds the search and checks the point. |
| Map with a fixed pin | `features/owner/components/location-picker/location-picker.ts` | The pin stays at the centre and the map moves under it: the pin lifts while dragging and drops on release. Nothing is saved until **Confirmar este punto**. Keyboard: the map pans with the arrows. |
| "Estoy en el local" | same, `GeolocationService.requestLocation(true)` | A fresh GPS fix (high accuracy) only moves the map; its accuracy is shown ("unos 12 m"). The explanation is shown before the system asks for the permission. |
| "Buscar" | `location-search.ts` → `geocode` Edge Function | Sent only when the owner presses it (provider quota). Bounded to the municipality: LocationIQ `viewbox` (a square of 15 km around the DANE centre, `lon,lat`), `bounded=1`, `countrycodes=co`, `addressdetails=1`, `dedupe=1`, `limit=5` (docs.locationiq.com/reference/search). Each candidate shows its type (calle, barrio, lugar…) and its distance to the centre; those farther than 15 km are dropped. Choosing one moves the map but **never confirms**; "Ninguno: lo muevo yo" closes the list. |
| Candidate label | `supabase/functions/geocode/providers.ts` | The searched name and its town ("Jamondino, Pasto"). The suburb of the point the provider returned is never shown: for "Jamondino" LocationIQ returned a point labelled "Centro", far from the real neighbourhood. |
| Address proposal | `location-proposal.ts` → `geocode` with `{ reverse }` | One reverse geocoding call per confirmed point (`/v1/reverse`, zoom 18, `normalizeaddress=1`). It proposes an address ("Calle 22 # 14-30") and a sector, marked **aproximado**; nothing is filled until "Usar esta dirección", and both fields stay editable. |
| Address, sector, reference | `business-basics-fields` | The owner writes the address with the validation rules (`TextRules.address`); the sector (`businesses.neighborhood`) and the reference ("al frente del parque", `businesses.address_reference`) are optional (migration `20261107000000_round10.sql`). |
| Warnings | `location-checks.ts` | A confirmed point more than 15 km from the municipality's centre (or outside it), or at the same point (under 15 m) as another business of the owner, shows a warning; it never blocks. |

Privacy: the bias point sent to the provider is rounded to about 1 km; the
reverse point to about 10 m (an address needs it). Answers are cached 48 hours
for LocationIQ (its terms) and the results show "Search by LocationIQ.com".

Tests: `location-checks.spec.ts`, `location-picker.spec.ts` (fake map and a
simulated geocoder whose "Centro" falls outside the municipality),
`supabase/functions/geocode/candidates.test.ts`.

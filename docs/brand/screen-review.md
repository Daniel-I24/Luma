# Screen review (round 2, phase 4.5)

## Method

- `npx ng build --configuration screens` builds the app with
  `src/environments/environment.screens.ts` (an invented, unreachable
  project; never the real `environment.ts`).
- `node scripts/screens/capture.mjs` serves that build locally, restores a
  fake session, answers the Supabase API with fixtures
  (`scripts/screens/fixtures.mjs`, empty lists and one customer profile) and
  aborts every other request. It captures 18 screens at 360, 412 and 768 px
  in the four themes (216 images) into `docs/screens/` (gitignored). It uses
  the system Edge through `playwright-core` (dev dependency, no browser
  download).
- `npm run check:tokens` (CI) fails on literal colours and px/rem/em lengths
  outside the token files; `npm run check:contrast` covers AA in every theme;
  `npm run check:interactive` covers touch targets and keyboard access.

With fixtures that return empty lists, the review covers structure,
spacing, empty, loading and error states; screens with real data
(business profile, order detail, owner panel, admin) still need a pass on a
device with the staging project.

## Findings and fixes

| Screen | Finding | Fix |
| --- | --- | --- |
| Luma IA | The preselected moment chip (e.g. "Media tarde") was off-screen at 360 px | `appRevealSelected` centres the selected chip once |
| Promociones | Native selects, checkbox and chips styled in the feature; white checkbox in Night | `LumaSelect` with labels and `LumaChip` ("Abierto ahora" as a chip) |
| Promociones | "Cualquier descuento" truncated at 360 px | Label "Cualquiera" / "Any" |
| Night theme | Native controls (checkboxes, select lists, scrollbars) stayed light | `color-scheme: dark` in Night, `accent-color` from `--color-primary` |
| Iniciar sesión, códigos | Submit button not full width, unlike sign-up | `[fullWidth]="true"` |
| Mis datos, registro | The chosen municipality had no label | "Municipio" label above the name |
| Ayuda, Perfil | No link to the refund policy | Link to `/legal/refunds` |
| Global | Literal px/rem/em in component CSS (borders, focus rings, font sizes) | Stroke, layout and type tokens; `check:tokens` in CI |

Checked without changes: tab bar and safe areas, empty states (cart,
orders, feed, favourites, notifications, promotions), sign-up step 1,
account details, help, legal and download pages, 44 px targets, the four
themes at 412 and 768 px (content keeps a centred column; the map is
full-bleed by design).

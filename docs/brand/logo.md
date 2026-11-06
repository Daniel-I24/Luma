# Logo

Since round 12 the launcher icon is `assets/icon-source.png`: a pin with a chef's hat,
fork and spoon over the Pasto volcanoes. The pin-moon notes below are its history;
the "Luma IA" icon in `LumaIcon` still draws the crescent.

Three concepts, all hand-built SVG on a 1024 grid (`docs/brand/concepts/`).

| Concept | File | Idea | Verdict |
| --- | --- | --- | --- |
| Pin-luna | `concepts/pin-moon.svg` | A map pin whose head has a crescent cut out (Luma: light, the moon over Pasto at dinner time) and a small ají dot (warmth, food). | **Chosen** |
| Cuenco | `concepts/bowl.svg` | A bowl whose steam rises as a small pin. | Says "food" well, but blurs at notification size and reads as a generic delivery app. |
| Barniz | `concepts/lacquer.svg` | Mopa-mopa lacquer diamonds forming an L. | Very local, but needs four colours and loses its meaning in one colour. |

## Why pin-luna

- It says what Luma does first: places on a map.
- It holds up in one colour and at 24 dp (the notification icon is the same
  path), which the other two do not.
- The crescent gives the name a picture without sparkles or gradients, and
  the ají dot ties it to the palette's accent.

## Geometry (all files use the same numbers)

- Pin: two cubic curves from the tip (512, 880) to the head, and the upper
  arc of the circle (512, 440, r 240).
- Crescent (a hole, `fill-rule="evenodd"`): circle (512, 440, r 136) minus
  circle (566, 400, r 116); SVG arcs `A136 136 0 1 0` then `A116 116 0 1 1`
  between (500.1, 304.5) and (638.1, 490.8), flags checked numerically.
- Ají dot: circle (596, 382, r 34), `#c93a0e` (round 8; was `#b23a0c`).
- Colours: paper `#f7f2e7` on deep Andean blue `#0b4f9c` (7.2:1; round 8).
- Store and Meta icon: `store/app-icon-1024.png` (the mark on the deep blue,
  sun crescent, ring of food doodles; original, generated with Pillow by
  `store/app-icon-generator.py` from the geometry above).

## Files

| Use | File |
| --- | --- |
| Source of the launcher icon | `assets/icon-source.png`, cut with `docs/brand/icon-generator.py` |
| Simplified mark (one colour, small sizes) | `assets/logo.svg`, `docs/brand/icon-vectors.py` |
| Mark and name | `docs/brand/wordmark.svg` (name in Bricolage Grotesque 700) |
| Launcher, adaptive (Android 8+) | `res/mipmap-anydpi-v26/ic_launcher*.xml`: PNG layers `mipmap-*/ic_launcher_background.png` (sky, ridges, plate) and `ic_launcher_foreground.png` (pin and hat, inside the 66 dp safe zone); themed `drawable/ic_luma_monochrome.xml` |
| Launcher, legacy (Android 7) | `res/mipmap-*/ic_launcher.png`, `ic_launcher_round.png` (both layers together) |
| Notification | `res/drawable/ic_stat_luma.xml` (white on transparent, pin with fork and spoon); accent `#E8127F`, `AndroidManifest.xml` and `push-dispatch/fcm.ts` |
| Native splash | `res/drawable-nodpi/ic_splash_mark.png` on `@color/luma_splash_background` (the deep purple of the icon), Android 12+ SplashScreen API (`styles.xml`) |
| Web | `public/favicon.svg`, `favicon.ico`, `public/icons/`, `manifest.webmanifest`, `theme-color` in `src/index.html` |
| Luma IA icon | `luma-ai` in `LumaIcon` (the crescent and the dot in outline), instead of sparkles |

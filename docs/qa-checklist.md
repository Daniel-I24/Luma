# QA checklist (manual, real phone)

Run on an Android phone with the APK and on a phone browser with the web app,
against the production project, with **test accounts** (one customer, one
owner, one admin). Automated coverage of the same paths: `src/testing/journeys`
and `npm run check:interactive`.

## Phone findings of 2026-10-19

| # | Finding | How to check | Expected |
| --- | --- | --- | --- |
| 1 | The sign-up email had a localhost link | Register a new account | The email has a 6-digit code and no link; the code confirms the account in the app |
| 2 | A business account saw the customer screens | Register as a business while migrations are missing (staging) or with the network cut right after signing in | "No pudimos cargar tu cuenta" with **Reintentar**; never the map tabs. After retrying online: Luma Negocios |
| 3 | Signing in without confirming the email | Register, do not enter the code, sign in | "Debes confirmar tu correo…" and "Verificar mi correo"; no session |
| 4 | The map search only filtered businesses | Type "San Ignacio", press Enter or "Buscar lugares" | Businesses filter while typing; places appear after submitting; choosing one flies the map with a pin |
| 5 | Every button must work | Tap every control of each screen below | Each one does something visible (navigates, saves, opens a sheet, shows an error); nothing silent |

## Customer

- [ ] Map: locate me (permission asked once), zoom, filters, nearby list, business sheet.
- [ ] Search: business name; neighbourhood; address "Calle 18 # 25-30"; a place outside Colombia gives "No encontramos…".
- [ ] Business profile: tabs, photos strip, WhatsApp/Instagram/web links open outside, report sheet.
- [ ] Order now and scheduled; cancel while pending; order detail updates.
- [ ] Favourites; reviews (needs a confirmed email).
- [ ] Profile: notification switches (promotions start off), "Permitir notificaciones" on the APK, theme, help, change password (wrong current password is refused), sign out, delete account.
- [ ] Offline (airplane mode): offline notice; nothing pretends to work.

## Owner (Luma Negocios)

- [ ] Register a business; every "Mi negocio" screen: info, contact (invalid WhatsApp refused), photos (8 max, reorder, two-tap delete), hours, verification documents.
- [ ] Submit for review; while pending, changing the name is refused with a clear message.
- [ ] Menu: add, edit, availability, delete; "Escanear menú con Luma IA" (AI_MODE remote): draft, fix a price, keep some, saved after the existing items.
- [ ] Promotions: create with discount, end now, "Avisar a mis seguidores" once (second time: "Ya avisaste…").
- [ ] Orders: a new order from the customer phone shows the toast, vibration and the badge on Pedidos from any tab; accept → preparing → ready → picked up; cancel after accepting.
- [ ] Push (if enabled): order notification arrives with the app closed; tapping opens the app.

## Admin

- [ ] Review queue: approve, request changes (note required), suspend, reactivate; a stale review shows "Recargar".
- [ ] Reports list without reporter identity.

## Accessibility and look

- [ ] Every touch target at least 44 px; focus visible with a keyboard.
- [ ] Themes Indigo, Midnight, Pearl, Sunset readable; system "reduce motion" removes animations.
- [ ] Spanish and English: no raw keys (`map.places.title`) on any screen.

## Round 5 (2026-10-28)

- Two owner accounts on the same phone: each sees only its own businesses
  and "N de 3 negocios"; at 3, "Añadir" is greyed with the reason.
- Web (localhost) and APK: "Ver como cliente" opens the map; the welcome's
  "Siguiente" and "Omitir" always work; a real error appears in the dev
  console, never in production.
- Sign in right after creating an account: no "no puedes ingresar"
  screen; with the network off it shows only after two silent retries.
- Delete account: consequences, then a code by e-mail (Magic Link template
  with `{{ .Token }}`), then delete; a wrong code never deletes; each failure
  has its own message.
- Type half a promotion, product, business data, legal data or the
  registration, leave and come back: "Recuperamos tu borrador"; "Descartar"
  restores; saving forgets it; leaving asks first. Signing out wipes drafts.
- Ajustes → "Ver tutorial" opens the welcome over the screen (the form stays
  as it was); "Ver todos los tutoriales" shows each guide again; the "?" of
  a screen repeats its guide; Escape and "Saltar" close it.
- First visit to Mapa, Descubrir, Pedidos, Luma IA, Perfil, Checkout,
  Resumen, Pedidos, Menú, Promociones and Mi negocio: the guide highlights
  the real control; with reduced motion nothing slides.
- Every text field shows an "Ej.: …" example (`npm run check:placeholders`).
- "Mi negocio": theme and language like in the Profile.
- Menú: "Escanear mi menú con IA" first; with Luma IA off it says so and
  offers "Pegar mi menú como texto" (try "Bandeja paisa ........ 28.000");
  change a price, mark "Agotado", move with the arrows and by dragging.
- An owner ordering from their own business is refused with "Este negocio
  es tuyo"; the business screen says so.
- Trust limit message: without payments it never mentions paying online
  and links to the pending order.
- Contacts: ask for a code, follow the steps (WhatsApp to support, bio,
  /.well-known/luma-verification.txt); the admin verifies it in /admin; the customer sees
  only verified contacts with the badge; changing a value removes the badge.
- Business screen → Información: trust card without NIT or legal data.
- Approved business → "Solicitar corrección de datos legales": warning,
  hidden until a new review, legal data and documents editable; in draft or
  changes requested every document has its upload button and explanation.
- "Cómo llegar" on the business and the order: the route on our map with
  km and minutes (walking or by car); without `ROUTE_API_KEY` a straight line
  marked as an estimate; "Abrir en Google Maps" always there.
- Perfil → Notificaciones → "Enviar notificación de prueba" (3 a day);
  with Firebase set up (docs/push-setup.md) it arrives on the phone and a
  tap on an order notice opens the order.
- Resumen: cover and logo with the verification state, cards with the trend
  against yesterday, quick actions; empty states with illustrations; order
  cards with their state colour; success toasts draw a check.

## Round 6 (2026-10-29)

- With `contact_auto_whatsapp = 1` and the webhook set up: "Verificar con
  WhatsApp" opens WhatsApp with the code; sent from that number, the badge
  appears within seconds while the screen shows "Esperando tu mensaje…"
  (it stops after 2 minutes). From another number, an invented code, an
  expired code (over 24 h) or someone else's code: nothing is verified.
- A landline (60…) is explained, with no request button and no badge.
- With `contact_auto_website = 1`: publish
  `/.well-known/luma-verification.txt` with the code and "Comprobar ahora"
  verifies; a wrong code, a missing file or the fourth check of the day says
  why.
- Instagram and Facebook still show the manual steps and are verified from
  /admin while the automatic strategies are on.
- Both flags at 0: every contact shows the manual steps again.
- Mi negocio → Ayuda → "Información técnica": masked e-mail, short user id,
  businesses in the panel and each read (table, filter, rows); "Copiar
  información" copies the same text; nothing personal appears.

## Round 7 (2026-10-31)

- Cómo llegar: four icon buttons (a pie, bicicleta, moto, carro); each one
  says its name to a screen reader and on hover; the chosen one shows it.
  Moto shows "Tiempo aproximado". Reload: the last mode stays chosen.
- Luma Negocios: "N de 3 negocios"; with 3, "Añadir" is disabled with the
  reason. A fourth business (also through the API) says "Llegaste al
  máximo…"; deleting one and creating again on the same day after 3
  creations says "Ya creaste 3 negocios hoy".
- A customer account opening /owner/<id> lands on Perfil with "Registra tu
  negocio" open; signing out of an owner and in as a customer on the same
  device never shows the panel.
- Mis datos: "Ana 3", "R2D2", an emoji or a single letter show the message
  under Nombre after leaving the field and on Guardar; "María José",
  "O'Connor" and "Ana-Lucía" save. A landline in Celular is refused.
- Business: a name with "#" or an emoji, an address without a number, a
  phone of 9 digits, a website without https:// (or http://, or an IP) show
  their message under the field. "(601) 234 5678" saves as a landline.
- Prices: the field keeps only digits; 50 and 10 000 001 are refused.
  Discounts 1 and 90 are fine, 0 and 91 are not. A promotion of more than a
  year is refused.
- Legal data: a wrong NIT check digit, "Ana 3" as representative.
- Pasting text with invisible characters (zero-width, direction marks) or
  double spaces saves it clean; nothing technical ever shows.
- Contact verification: a fourth Instagram code in a day is refused while
  the website can still ask for one; each new code replaces the pending one.
- `npm run check:validation` passes; adding an `<input>` without a validator
  makes it fail.
- After migration 54: `docs/data-quality.sql` lists nothing (or the rows to
  fix) before VALIDATE.

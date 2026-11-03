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

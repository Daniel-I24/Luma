# Decisions

Choices made while the owner was away. Each one: what, why, and the
alternative that was not taken. The safest, most reversible option wins.

## 2026-10-18 — CI: isolate the Vitest spec files

- **What**: `angular.json` → `test.options.isolate: true`.
- **Why**: the Angular unit-test builder defaults to `isolate: false`, so spec
  files in the same worker share one module registry. A spec that loaded the
  real `maplibre-gl` first made `vi.mock('maplibre-gl')` useless in later
  specs; it only showed on machines with fewer cores (GitHub runners).
  Reproduced on Linux (Docker, one core): 2 of 3 full runs failed before, 30
  runs alone and 10 full runs green after.
- **Alternative**: mock `maplibre-gl` in every spec that touches the map, or
  disable code splitting. Fragile: the next spec without the mock breaks it
  again. Cost of isolation: slower suite (about 75 s instead of 45 s locally).

## 2026-10-18 — delete-account: recent sign-in window of 10 minutes

- **What**: 403 `reauth_required` when `last_sign_in_at` is older than 10
  minutes, unreadable or missing.
- **Why**: deleting is irreversible; a refreshed token proves nothing about
  who holds the phone. `last_sign_in_at` changes only on password or code
  sign-in.
- **Alternative**: ask for the password again inside the delete sheet. Better
  UX, but sends the password to a second place; can be added later on top.

## 2026-10-18 — Stepped sign-up keeps its draft in memory

- **What**: `SignupDraftStore` is root-provided and never persisted.
- **Why**: the draft must survive opening `/legal/terms` and coming back, but
  the password must never reach `localStorage` or `sessionStorage`. A reload
  loses the draft; that is acceptable for a four-step form.
- **Alternative**: open the legal pages in a new tab or a sheet. New tabs
  behave badly inside the Android WebView.

## 2026-10-18 — One consent flag for terms, privacy and legal age

- **What**: three separate checkboxes in the app, but `handle_new_user` keeps
  reading the single `accepted_terms` flag; the app sends `true` only when
  all three are checked.
- **Why**: the account-types migration (not applied) already records
  `consented_at` and `terms_version` from that flag; no SQL change needed.
- **Alternative**: three columns. More precise evidence, but a migration for
  data the app already enforces; revisit with the legal review.

## 2026-10-18 — Tutorial is a page, shown on landing

- **What**: `/welcome`, reached through `accountHomeGuard` (and the login,
  code and recovery screens) when `onboarding_seen_version` is older than
  `ONBOARDING_VERSION`. "Omitir" and "Empezar" both record it; a failed save
  shows a notice and still lets the user in.
- **Why**: a route is testable, reachable again from the Profile, and never
  traps the user.
- **Alternative**: an overlay on the home screen. Harder to make accessible
  (focus trap, back button) for no gain.

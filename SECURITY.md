# Security policy

## Reporting a vulnerability

Please do **not** open a public issue. Write to the maintainer through a
private GitHub security advisory on this repository ("Security" tab →
"Report a vulnerability"). Include what you found, how to reproduce it and
what an attacker could do. We answer within 7 days and agree on a date
before anything is published.

Do not access other people's data, run denial-of-service tests, or test
payments with real cards. Wompi's sandbox (test keys and test cards) is the
place for payment tests.

## Scope

- The Luma web app and Android app (`src/`, `android/`).
- The Supabase schema, policies and functions (`supabase/migrations/`).
- The Edge Functions (`supabase/functions/`).

Out of scope: Supabase, Wompi, Firebase, LocationIQ/Nominatim and the
LLM providers themselves (report to them).

## How Luma is protected

A summary is in [docs/security.md](docs/security.md); the threats and their
controls in [docs/threat-model.md](docs/threat-model.md); the payment
controls in [docs/payments-checklist.md](docs/payments-checklist.md).

## Supported versions

Only the latest release of the app and the current `main` branch receive
fixes.

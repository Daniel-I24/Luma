# delete-account

Edge Function that permanently deletes the **caller's own** account
(right to erasure, Ley 1581 de 2012).

## Contract

`POST /functions/v1/delete-account` with `Authorization: Bearer <user access token>`.

| Case                                   | Status | Body                                |
| -------------------------------------- | ------ | ----------------------------------- |
| Account deleted                        | 200    | `{ "deleted": true }`               |
| `OPTIONS` preflight (allowed origin)   | 204    | —                                   |
| Origin not in the allow list           | 403    | `{ "error": "origin_not_allowed" }` |
| Any method other than POST / OPTIONS   | 405    | `{ "error": "method_not_allowed" }` |
| Missing, malformed or invalid token    | 401    | `{ "error": "unauthorized" }`       |
| Last sign-in more than 10 minutes ago  | 403    | `{ "error": "reauth_required" }`    |
| Deletion failed / Auth or Storage down | 500    | `{ "error": "delete_failed" }`      |

## Security

- The user is identified **only** by the JWT, validated with `auth.getUser()`.
  Any user id in the body or URL is ignored: a caller can only delete themself.
- Recent sign-in required: `last_sign_in_at` (password or emailed code) must
  be at most 10 minutes old. A refreshed token does not count, so a stolen or
  forgotten session cannot erase the account. The app asks the user to sign in
  again (`auth.errors.reauthRequired`).
- `verify_jwt = true` stays on in `supabase/config.toml`, so the platform also
  rejects requests without a valid JWT before the code runs.
- The service role key comes from the `SUPABASE_SERVICE_ROLE_KEY` variable that
  Supabase injects; it is never in the code nor logged. Logs contain only fixed
  messages (no tokens, emails, ids or passwords).
- CORS uses an allow list from `ALLOWED_ORIGINS`, never `*`: a
  comma-separated list matched **exactly** (scheme, host and port; no
  wildcards, entries containing `*` and empty entries are ignored). The legacy
  single `ALLOWED_ORIGIN` is still read and merged in. With neither set, no
  browser origin is allowed. Requests from other browser origins get 403.

## What is deleted (cascade)

`auth.admin.deleteUser` removes the `auth.users` row; Postgres foreign keys
(`on delete cascade`) remove the rest:

- `profiles` — the user's profile (display name, email copy).
- `favorites` — the user's saved businesses.
- `reviews` — every review the user wrote.
- `businesses` the user owns, and with them their `business_hours`,
  `promotions`, `menu_items`, and the favorites and reviews **other users**
  left on those businesses.

Before that, the function deletes the files of the user's businesses: the
pictures in `business-images` (`{business_id}/{logo|cover|menu|promotions}/…`)
and the private verification documents in `verification-docs`
(`{business_id}/{rut|facade|other}/…`), see `storage-cleanup.ts`. If Storage fails, it answers 500
`delete_failed` and the account is **not** deleted, so the user can retry
without leaving files behind.

Orders the user placed are anonymised, not deleted (`orders.user_id` set to
NULL and `notes` cleared), so the businesses keep their history; orders
that other customers placed at the user's businesses are kept with
`business_id` set to NULL and the copied business name and address
(`docs/orders.md`).

## Configuration

| Variable                    | Source                     |
| --------------------------- | -------------------------- |
| `SUPABASE_URL`              | Injected by Supabase       |
| `SUPABASE_SERVICE_ROLE_KEY` | Injected by Supabase       |
| `ALLOWED_ORIGINS`           | Secret, comma-separated exact origins (see below) |
| `ALLOWED_ORIGIN`            | Legacy single origin, still accepted |

Recommended `ALLOWED_ORIGINS`:

- Production: `https://localhost,https://<vercel-domain>` (`https://localhost`
  is the Capacitor Android WebView origin).
- Development project only: add `http://localhost:4200` (`ng serve`).

## Test

```sh
cd supabase/functions/delete-account
deno test --no-lock . ../_shared
```

## Deploy (manual)

```sh
supabase login
supabase link --project-ref <project-ref>
supabase secrets set ALLOWED_ORIGINS=https://localhost,https://<vercel-domain>
supabase functions deploy delete-account
```

Do not pass `--no-verify-jwt`.

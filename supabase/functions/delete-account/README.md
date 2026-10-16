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
| Deletion failed / Auth unreachable     | 500    | `{ "error": "delete_failed" }`      |

## Security

- The user is identified **only** by the JWT, validated with `auth.getUser()`.
  Any user id in the body or URL is ignored: a caller can only delete themself.
- `verify_jwt = true` stays on in `supabase/config.toml`, so the platform also
  rejects requests without a valid JWT before the code runs.
- The service role key comes from the `SUPABASE_SERVICE_ROLE_KEY` variable that
  Supabase injects; it is never in the code nor logged. Logs contain only fixed
  messages (no tokens, emails, ids or passwords).
- CORS uses an allow list (`http://localhost:4200` plus `ALLOWED_ORIGIN`),
  never `*`. Requests from other browser origins get 403.

## What is deleted (cascade)

`auth.admin.deleteUser` removes the `auth.users` row; Postgres foreign keys
(`on delete cascade`) remove the rest:

- `profiles` — the user's profile (display name, email copy).
- `favorites` — the user's saved businesses.
- `reviews` — every review the user wrote.
- `businesses` the user owns, and with them their `business_hours`,
  `promotions`, `menu_items`, and the favorites and reviews **other users**
  left on those businesses.

There are no Storage buckets yet; when uploads are added, their objects must
be removed here too.

## Configuration

| Variable                    | Source                     |
| --------------------------- | -------------------------- |
| `SUPABASE_URL`              | Injected by Supabase       |
| `SUPABASE_SERVICE_ROLE_KEY` | Injected by Supabase       |
| `ALLOWED_ORIGIN`            | Secret, e.g. production web origin |

## Test

```sh
cd supabase/functions/delete-account
deno test --no-lock
```

## Deploy (manual)

```sh
supabase login
supabase link --project-ref <project-ref>
supabase secrets set ALLOWED_ORIGIN=https://<web-origin>
supabase functions deploy delete-account
```

Do not pass `--no-verify-jwt`.

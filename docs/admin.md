# Review team (admins)

Admins review businesses and reports at `/admin` (the Profile shows the
entry only to them). The app hides the screen from everyone else, but the
real check is in the database: every admin action calls `is_admin()`.

**Two-factor authentication is required.** Since round 2, `is_admin()` is
true only when the session's JWT has `aal = aal2`: the admin signed in and
then verified a TOTP code (Supabase Auth MFA). `admin_access()` tells the
app `none`, `needs_mfa` or `ok` (a failed call is `error` with its code: message and
"Reintentar" at `/admin/access-error`, never a silent redirect); with `needs_mfa` the app asks for the code
(or enrolls the authenticator the first time). Enable "Authenticator app
(TOTP)" in Supabase Auth > Multi-Factor before applying migration 32.

Every admin action is written to `admin_audit_log` (append only: no role can
update or delete it): `review_business`, `void_payment`,
`mark_refund_done`, `clear_strikes`, `reconcile_payments`, with who, what,
target and when. `admin_recent_audit(limit)` shows the latest ones.

## Granting and revoking admin rights

There is no screen for this on purpose. Run it in the Supabase SQL editor
(as the project owner), with the email of an **existing, confirmed** account:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'reviewer@example.com'
on conflict (user_id) do nothing;
```

Revoke:

```sql
delete from public.admins
where user_id = (select id from auth.users where email = 'reviewer@example.com');
```

List:

```sql
select u.email, a.created_at
from public.admins a join auth.users u on u.id = a.user_id
order by a.created_at;
```

`public.admins` has RLS on and no grants to `anon` or `authenticated`: only
the SQL editor (or `service_role`) can change it. Deleting the user removes
the row (`on delete cascade`).

## What admins can do

| Action | How | Rule |
| --- | --- | --- |
| See businesses in any state, with menu and hours | `/admin` queue | `is_admin()` in the read policies |
| Read legal data and documents | review page, 60 s signed URLs | private tables and bucket |
| Approve / request changes | `review_business(id, 'approved' \| 'rejected', note)` | only from `pending`; note required to reject |
| Suspend | `review_business(id, 'suspended', note)` | only from `approved`; note required |
| See and resolve open reports | `admin_open_reports()`, `resolve_report()` | never the reporter |
| See warning signs of a business | `business_review_flags(id)` | duplicate NIT, duplicate phone or WhatsApp, another owner's business within 50 m, a similar approved name, account age, businesses of the owner |
| Payment problems and refunds | `admin_payment_issues()`, `void-payment`, `admin_mark_refund_done()` | docs/payments.md |
| No-show strikes | `admin_strikes()`, `admin_clear_strikes(user)` | ids and counts only |

Admins cannot write `verification_*` columns directly (no column grants):
every decision goes through `review_business`, which also notifies the
owner (`business_review`).

## Screens

- `/admin/mfa`: TOTP enrollment (secret key for the authenticator app) and
  the 6-digit challenge on every new session.
- `/admin`: the review queue; `/admin/businesses/:id` shows the warning signs
  (`business_review_flags`) above the location, legal data and documents.
- `/admin/operations`: payments that need a person (void by API for cards,
  "Marcar reembolsado" for the rest), "Conciliar ahora", customers with
  no-show strikes ("Limpiar") and the recent audit log. Ids are shortened on
  screen; no names, emails or phones are shown.

## Review checklist

1. NIT and legal name match [RUES](https://www.rues.org.co/) and the RUT.
   A NIT already used by a pending or approved business of another user is
   refused when the owner submits (`tax_id_in_use`); check the warning signs
   on the review page anyway.
2. The facade photo matches the address and the map pin.
3. Name, category, menu and prices look real (no placeholder text).
4. Phone answers (spot checks).
5. Rejections and suspensions say exactly what to fix.

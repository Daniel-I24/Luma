# Review team (admins)

Admins review businesses and reports at `/admin` (the Profile shows the
entry only to them). The app hides the screen from everyone else, but the
real check is in the database: every admin action calls `is_admin()`.

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

Admins cannot write `verification_*` columns directly (no column grants):
every decision goes through `review_business`, which also notifies the
owner (`business_review`).

## Review checklist

1. NIT and legal name match [RUES](https://www.rues.org.co/) and the RUT.
2. The facade photo matches the address and the map pin.
3. Name, category, menu and prices look real (no placeholder text).
4. Phone answers (spot checks).
5. Rejections and suspensions say exactly what to fix.

# Roles and permissions

Three kinds of people use Luma. The account type lives in
`profiles.account_type`; admins are listed in `public.admins`. The app
adapts its screens, but every rule below is enforced by the database (RLS,
column grants and `SECURITY DEFINER` functions).

| | Visitor (`anon`) | Customer | Business owner | Admin |
| --- | --- | --- | --- | --- |
| Home after signing in | — | `/map` | `/owner` (Luma Negocios) | as their account type, plus `/admin` |
| See public businesses, menus, hours, promotions, reviews | yes | yes | yes | yes |
| See businesses that are not public (draft, pending, rejected, suspended) | no | no | own only | all |
| Favourites, reviews, orders | no | own | own (as a customer) | own |
| Create businesses | no | no (`become_business_owner` first) | up to 3 | as owner only |
| Edit business data, hours, menu, promotions, images | no | no | own businesses | no |
| Publish / pause | no | no | own, once approved | no |
| Legal data and verification documents | no | no | own; edit only in draft or rejected | read all |
| Submit for review | no | no | own (`submit_business_for_review`) | no |
| Approve, request changes, suspend | no | no | no | `review_business` |
| Write `verification_*` columns directly | no | no | no | no |
| Orders of a business (`business_orders`) | no | no | own businesses, without customer email, phone or id | no |
| Change order status | no | cancel own pending | accept → prepare → ready → picked up, or cancel | no |
| Report a business | no | yes | yes | yes |
| Read reports | no | no | no | open reports, never the reporter |
| Private profile data (full name, phone) | no | own | own | no |
| Delete the account (Edge Function, recent sign-in) | — | yes | yes (businesses, files and documents go too) | yes |

Notes:

- Customers never give an address: orders are picked up (Ley 1581,
  principle of necessity).
- A customer becomes an owner from the Profile ("¿Tienes un negocio?
  Regístralo"); there is no way back from the app.
- Owners can open the customer view ("Ver como cliente") and return through
  the banner at the top or the Profile.
- Granting admin rights: [admin.md](admin.md). Verification states:
  [verification.md](verification.md).

-- -----------------------------------------------------------------------------
-- Migration: business_orders
-- What a business owner sees of the orders placed at their businesses.
-- NOT APPLIED YET: review before running.
--
-- Security notes:
--   - The orders RLS only lets customers read their own orders. Owners read
--     through these two views instead, which run with the view owner's
--     rights and filter to businesses whose owner_id is auth.uid().
--   - security_barrier: the filter runs before any condition the caller
--     adds, so no row of another business can leak through a function.
--   - They never expose user_id or the email: the customer appears only as
--     customer_label, their public display_name (NULL when they have none;
--     the app shows "Cliente").
--   - SELECT only, and only for authenticated. Status changes go through
--     public.set_order_status (valid transitions only).
-- -----------------------------------------------------------------------------

create or replace view public.business_orders
  with (security_invoker = false, security_barrier = true)
as
select
  o.id,
  o.business_id,
  o.status,
  o.pickup_at,
  o.total_cop,
  o.notes,
  o.payment_method,
  o.created_at,
  o.updated_at,
  nullif(btrim(p.display_name), '') as customer_label
from public.orders o
join public.businesses b on b.id = o.business_id
left join public.profiles p on p.id = o.user_id
where b.owner_id = (select auth.uid());

comment on view public.business_orders is
  'Orders of the caller''s businesses, without user_id or email (customer_label only).';

create or replace view public.business_order_items
  with (security_invoker = false, security_barrier = true)
as
select
  i.id,
  i.order_id,
  i.name,
  i.unit_price_cop,
  i.quantity
from public.order_items i
join public.orders o on o.id = i.order_id
join public.businesses b on b.id = o.business_id
where b.owner_id = (select auth.uid());

comment on view public.business_order_items is
  'Lines of the orders of the caller''s businesses.';

revoke all on public.business_orders, public.business_order_items from public, anon, authenticated;
grant select on public.business_orders, public.business_order_items to authenticated;

notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Migration: cancellation_rules (pending review).
--   1. cancel_order: the customer may cancel until the kitchen starts: while it
--      waits for its payment, is pending or accepted. From 'preparing' on the
--      answer is too_late_to_cancel. Same signature and grants.
--   2. orders.cancel_reason also says 'customer' and 'payment_expired', so each
--      side can read why an order ended. The owner's reasons do not change.
--   3. expire_stale_orders marks the unpaid orders it closes as payment_expired.
--   4. payments_to_void(): refunds a card payment can settle by itself; the
--      reconciliation voids them in Wompi (docs/payments.md). Service role only.
-- A paid order that is cancelled still becomes refund_required, by the trigger
-- orders_paid_cancelled of 20261030000340_payment_admin.sql.
-- -----------------------------------------------------------------------------

alter table public.orders drop constraint orders_cancel_reason_valid;
alter table public.orders add constraint orders_cancel_reason_valid check (
  cancel_reason is null
  or cancel_reason in ('out_of_stock', 'closed', 'no_show', 'other', 'customer', 'payment_expired')
);

create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select o.status into v_status from public.orders o
  where o.id = p_order_id and o.user_id = auth.uid() for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'order_not_found';
  end if;
  if v_status in ('preparing', 'ready') then
    raise exception using errcode = 'P0001', message = 'too_late_to_cancel';
  end if;
  if v_status not in ('awaiting_payment', 'pending', 'accepted') then
    raise exception using errcode = 'P0001', message = 'invalid_transition';
  end if;
  update public.orders set status = 'cancelled', cancel_reason = 'customer' where id = p_order_id;
end;
$$;

revoke execute on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to authenticated;

create or replace function public.expire_stale_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_minutes integer := coalesce(
    (select s.int_value from public.app_settings s where s.key = 'order_pending_expiry_minutes'), 30);
  v_payment_minutes integer := coalesce(
    (select s.int_value from public.app_settings s where s.key = 'payment_awaiting_expiry_minutes'), 15);
  v_count integer;
begin
  update public.orders o
  set status = 'cancelled',
      cancel_reason = case when o.status = 'awaiting_payment' then 'payment_expired' else o.cancel_reason end
  where (o.status = 'pending'
         and coalesce(o.pickup_at, o.created_at) + make_interval(mins => v_minutes) < now())
     or (o.status = 'awaiting_payment' and o.created_at + make_interval(mins => v_payment_minutes) < now());
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.expire_stale_orders() from public, anon, authenticated;
grant execute on function public.expire_stale_orders() to service_role;

create or replace function public.payments_to_void()
returns table (transaction_id text, environment text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.approved_transaction_id, p.environment
  from public.payments p
  where p.status = 'refund_required'
    and p.approved_transaction_id is not null
    and upper(coalesce(p.payment_method_type, '')) = 'CARD'
    and p.created_at > now() - interval '7 days'
  order by p.created_at
  limit 20
$$;

revoke execute on function public.payments_to_void() from public, anon, authenticated;
grant execute on function public.payments_to_void() to service_role;

notify pgrst, 'reload schema';

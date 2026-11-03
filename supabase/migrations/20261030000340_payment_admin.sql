-- -----------------------------------------------------------------------------
-- Migration: payment_admin
--   1. A paid order that is cancelled (by anyone) becomes refund_required:
--      the customer and the admins are told (orders_paid_cancelled trigger).
--   2. cancel_order: same signature; the customer may also cancel while the
--      order is awaiting its payment.
--   3. admin_payment_issues(): attempts that need a person (refund_required,
--      error, mismatching events, pending for over an hour). Admin with aal2;
--      ids, amounts and statuses only, no personal data.
--   4. admin_request_void(payment): checks the attempt can be voided, logs
--      'void_payment' and returns what void-payment needs. Only cards can be
--      voided through the Wompi API; others stay in "Reembolsos pendientes".
--   5. admin_mark_refund_done(payment): the admin refunded it in the Wompi
--      dashboard; refund_required -> refunded (logged).
-- Depends on 20261030000330_apply_payment_event.sql.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

create or replace function public.orders_paid_cancelled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and new.payment_status = 'approved' then
    perform public.mark_refund_required(new.id);
  end if;
  return null;
end;
$$;

revoke execute on function public.orders_paid_cancelled() from public, anon, authenticated;
drop trigger if exists orders_paid_cancelled on public.orders;
create trigger orders_paid_cancelled after update of status on public.orders
  for each row execute function public.orders_paid_cancelled();

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
  if v_status not in ('pending', 'awaiting_payment') then
    raise exception using errcode = 'P0001', message = 'invalid_transition';
  end if;
  update public.orders set status = 'cancelled' where id = p_order_id;
end;
$$;

revoke execute on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to authenticated;

create or replace function public.admin_payment_issues()
returns table (payment_id uuid, order_id uuid, reference text, amount_in_cents bigint, status text,
               payment_method_type text, issue text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  return query
  select p.id, p.order_id, p.reference, p.amount_in_cents, p.status, p.payment_method_type,
         case when p.status = 'refund_required' then 'refund_required'
              when exists (select 1 from public.payment_events e where e.payment_id = p.id and e.outcome = 'mismatch')
                then 'mismatch'
              when p.status = 'error' then 'error'
              else 'stuck_pending' end,
         p.created_at
  from public.payments p
  where p.status in ('refund_required', 'error')
     or (p.status = 'pending' and p.created_at < now() - interval '1 hour' and p.created_at > now() - interval '7 days')
     or exists (select 1 from public.payment_events e where e.payment_id = p.id and e.outcome = 'mismatch')
  order by p.created_at desc
  limit 200;
end;
$$;

revoke execute on function public.admin_payment_issues() from public, anon;
grant execute on function public.admin_payment_issues() to authenticated;

create or replace function public.admin_request_void(p_payment_id uuid)
returns table (transaction_id text, environment text, card boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment record;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  select p.approved_transaction_id, p.environment, p.payment_method_type, p.status into v_payment
  from public.payments p where p.id = p_payment_id;
  if not found or v_payment.status not in ('approved', 'refund_required') or v_payment.approved_transaction_id is null then
    raise exception using errcode = 'P0001', message = 'payment_not_voidable';
  end if;
  perform public.log_admin_action('void_payment', 'payment', p_payment_id);
  return query select v_payment.approved_transaction_id, v_payment.environment, v_payment.payment_method_type = 'CARD';
end;
$$;

revoke execute on function public.admin_request_void(uuid) from public, anon;
grant execute on function public.admin_request_void(uuid) to authenticated;

create or replace function public.admin_mark_refund_done(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  update public.payments set status = 'refunded'
  where id = p_payment_id and status = 'refund_required' returning order_id into v_order;
  if v_order is null then
    raise exception using errcode = 'P0001', message = 'payment_not_refundable';
  end if;
  update public.orders set payment_status = 'refunded' where id = v_order;
  insert into public.notifications (user_id, type, order_id, status)
  select o.user_id, 'payment', o.id, 'refunded' from public.orders o where o.id = v_order and o.user_id is not null;
  perform public.log_admin_action('mark_refund_done', 'payment', p_payment_id);
end;
$$;

revoke execute on function public.admin_mark_refund_done(uuid) from public, anon;
grant execute on function public.admin_mark_refund_done(uuid) to authenticated;

notify pgrst, 'reload schema';

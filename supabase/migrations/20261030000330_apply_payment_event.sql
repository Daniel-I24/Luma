-- -----------------------------------------------------------------------------
-- Migration: apply_payment_event
--   1. mark_refund_required(order) (internal): the approved attempt of a
--      cancelled order becomes refund_required; the customer and every admin
--      get a 'payment' notification.
--   2. apply_payment_event(...): service_role only (wompi-webhook,
--      reconcile-payments, void-payment call it AFTER confirming the
--      transaction with the Wompi API). One transaction, idempotent:
--        - unknown reference: logged, nothing else;
--        - same transaction and status again: 'duplicate', nothing changes;
--        - amount (payment and orders.total_cop * 100), currency COP or
--          environment differ: logged as 'mismatch', nothing changes;
--        - otherwise the state machine decides: 'applied' or 'ignored'.
--      An approval moves the order from awaiting_payment to pending (only
--      then is the owner told). An approval for an order that was cancelled
--      meanwhile becomes refund_required. A late failure of an older attempt
--      never overwrites the order's status.
--   3. payments_to_reconcile(min age, limit): service_role only; attempts with a
--      redirect transaction id that are still open after the given age.
-- Depends on 20261030000320_prepare_payment.sql.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

create or replace function public.mark_refund_required(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  update public.payments p set status = 'refund_required'
  where p.order_id = p_order_id and p.status = 'approved';
  if not found then
    return;
  end if;
  update public.orders o set payment_status = 'refund_required' where o.id = p_order_id returning o.user_id into v_user;
  insert into public.notifications (user_id, type, order_id, status)
  select u, 'payment', p_order_id, 'refund_required'
  from (select v_user as u where v_user is not null union select a.user_id from public.admins a) recipients;
end;
$$;

revoke execute on function public.mark_refund_required(uuid) from public, anon, authenticated;

create or replace function public.apply_payment_event(
  p_reference text, p_transaction_id text, p_status text, p_amount_in_cents bigint,
  p_currency text, p_environment text, p_payment_method_type text, p_source text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment record;
  v_order   record;
  v_target  text := case p_status when 'APPROVED' then 'approved' when 'DECLINED' then 'declined'
                                  when 'ERROR' then 'error' when 'VOIDED' then 'voided' end;
  v_latest  boolean;
  v_outcome text;
begin
  if p_status not in ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR')
     or p_transaction_id !~ '^[0-9A-Za-z_-]{1,64}$' or p_source not in ('webhook', 'reconcile', 'void') then
    raise exception using errcode = '22023', message = 'invalid_event';
  end if;
  select * into v_payment from public.payments p where p.reference = p_reference for update;
  if not found then
    insert into public.payment_events (provider_transaction_id, provider_status, amount_in_cents, source, outcome)
    values (p_transaction_id, p_status, coalesce(p_amount_in_cents, 0), p_source, 'unknown_reference')
    on conflict do nothing;
    return 'unknown_reference';
  end if;
  -- Checked under the payment lock, so two deliveries of one event cannot both pass.
  if exists (select 1 from public.payment_events e
             where e.provider_transaction_id = p_transaction_id and e.provider_status = p_status) then
    return 'duplicate';
  end if;
  select o.id, o.status, o.total_cop, o.user_id into v_order from public.orders o where o.id = v_payment.order_id for update;

  if p_amount_in_cents is distinct from v_payment.amount_in_cents
     or p_amount_in_cents is distinct from v_order.total_cop::bigint * 100
     or p_currency is distinct from 'COP' or p_environment is distinct from v_payment.environment then
    v_outcome := 'mismatch';
  elsif v_target is null or v_target = v_payment.status
        or not public.payment_transition_allowed(v_payment.status, v_target) then
    v_outcome := 'ignored';
  else
    v_outcome := 'applied';
    v_latest := v_payment.attempt = (select max(p.attempt) from public.payments p where p.order_id = v_order.id);
    update public.payments p
    set status = v_target,
        approved_transaction_id = case when v_target = 'approved' then p_transaction_id else p.approved_transaction_id end,
        payment_method_type = coalesce(nullif(substring(upper(p_payment_method_type) from '^[A-Z_]{1,30}$'), ''),
                                       p.payment_method_type)
    where p.id = v_payment.id;
    if v_target = 'approved' or v_latest then
      update public.orders o
      set payment_status = v_target,
          status = case when v_target = 'approved' and o.status = 'awaiting_payment' then 'pending' else o.status end
      where o.id = v_order.id;
    end if;
    if v_target = 'approved' and v_order.status = 'cancelled' then
      perform public.mark_refund_required(v_order.id);
    elsif v_order.user_id is not null and (v_target <> 'approved' or v_order.status = 'awaiting_payment') then
      insert into public.notifications (user_id, type, order_id, status)
      values (v_order.user_id, 'payment', v_order.id, v_target);
    end if;
  end if;

  insert into public.payment_events (payment_id, provider_transaction_id, provider_status, amount_in_cents, source, outcome)
  values (v_payment.id, p_transaction_id, p_status, coalesce(p_amount_in_cents, 0), p_source, v_outcome)
  on conflict do nothing;
  return v_outcome;
end;
$$;

revoke execute on function public.apply_payment_event(text, text, text, bigint, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_payment_event(text, text, text, bigint, text, text, text, text) to service_role;

create or replace function public.payments_to_reconcile(p_min_age_seconds integer default 180, p_limit integer default 50)
returns table (payment_id uuid, reference text, transaction_id text, environment text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.reference, coalesce(p.approved_transaction_id, p.candidate_transaction_id), p.environment
  from public.payments p
  where p.status in ('pending', 'declined', 'error') and p.candidate_transaction_id is not null
    and p.created_at < now() - make_interval(secs => greatest(coalesce(p_min_age_seconds, 180), 60))
    and p.created_at > now() - interval '2 days'
  order by p.created_at
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

revoke execute on function public.payments_to_reconcile(integer, integer) from public, anon, authenticated;
grant execute on function public.payments_to_reconcile(integer, integer) to service_role;

notify pgrst, 'reload schema';

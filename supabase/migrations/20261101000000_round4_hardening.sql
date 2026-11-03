-- -----------------------------------------------------------------------------
-- Migration: round4_hardening
-- Migrations 1 to 50 are applied; this one only adds and replaces. Same
-- signatures, return types and grants for every replaced function.
--   1. Notifications: statuses 'refund_pending_admin' (to admins) and
--      'duplicate_charge' (to the customer).
--   2. private.flag_payment_refund(payment, customer status): one approved
--      payment -> refund_required; tells the customer and every admin.
--      mark_refund_required(order) uses it for each approved payment.
--   3. prepare_payment: 'attempt_in_progress' while the latest attempt is
--      pending and younger than payment_retry_wait_seconds (180); the hint
--      carries the seconds left.
--   4. apply_payment_event: resolves the order from the reference WITHOUT a
--      lock, then locks the order and then the payment (the same order as
--      cancellations and mark_refund_required). The approval of another
--      attempt of an order already paid becomes refund_required
--      ('duplicate_charge'); the order keeps its status.
--   5. payments_to_reconcile: also pending attempts older than 3 minutes
--      without a redirect id (transaction_id null: Wompi documents no search
--      by reference, so reconcile-payments skips them; the webhook settles
--      them, admin_payment_issues lists them after an hour).
--   6. admin_request_void: only refund_required payments or approved payments
--      of cancelled orders. admin_mark_refund_done locks the order first and
--      leaves an order that is still paid by another attempt as it is.
--   7. payments: REVOKE ALL from service_role (only SECURITY DEFINER
--      functions read or write it).
--   8. business_order_items excludes orders awaiting payment.
--   9. tax_id_taken: only approved businesses of another owner block;
--      review_business refuses an approval with 'tax_id_in_use' under the same rule.
--  10. Trigger functions are not RPCs: set_updated_at() and, when this role
--      may change it, rls_auto_enable() (created by Supabase) lose EXECUTE for
--      PUBLIC, anon and authenticated.
-- -----------------------------------------------------------------------------

-- 1. Notifications --------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_status_valid;
alter table public.notifications add constraint notifications_status_valid check (
  status is null or status in ('awaiting_payment', 'pending', 'accepted', 'preparing', 'ready', 'picked_up',
                               'cancelled', 'approved', 'rejected', 'suspended', 'declined', 'voided',
                               'refund_required', 'refunded', 'error', 'refund_pending_admin', 'duplicate_charge'));

insert into public.app_settings (key, int_value) values ('payment_retry_wait_seconds', 180)
on conflict (key) do nothing;

-- 2. One payment to refund ------------------------------------------------------------------
-- The caller holds the lock of the order already (order first, then payment).
create or replace function private.flag_payment_refund(p_payment_id uuid, p_customer_status text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order uuid;
begin
  if p_customer_status not in ('refund_required', 'duplicate_charge') then
    raise exception using errcode = '22023', message = 'invalid_refund_status';
  end if;
  update public.payments p set status = 'refund_required'
  where p.id = p_payment_id and p.status = 'approved'
  returning p.order_id into v_order;
  if v_order is null then
    return false;
  end if;
  insert into public.notifications (user_id, type, order_id, status)
  select o.user_id, 'payment', o.id, p_customer_status from public.orders o
  where o.id = v_order and o.user_id is not null;
  insert into public.notifications (user_id, type, order_id, status)
  select a.user_id, 'payment', v_order, 'refund_pending_admin' from public.admins a;
  return true;
end;
$$;

revoke execute on function private.flag_payment_refund(uuid, text) from public, anon, authenticated;

create or replace function public.mark_refund_required(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment uuid;
  v_flagged boolean := false;
begin
  perform 1 from public.orders o where o.id = p_order_id for update;
  for v_payment in
    select p.id from public.payments p where p.order_id = p_order_id and p.status = 'approved'
    order by p.attempt for update
  loop
    v_flagged := private.flag_payment_refund(v_payment, 'refund_required') or v_flagged;
  end loop;
  if v_flagged then
    update public.orders o set payment_status = 'refund_required' where o.id = p_order_id;
  end if;
end;
$$;

revoke execute on function public.mark_refund_required(uuid) from public, anon, authenticated;

-- 3. prepare_payment ------------------------------------------------------------------------------
create or replace function public.prepare_payment(p_order_id uuid, p_environment text)
returns table (reference text, amount_in_cents bigint, currency text, expires_at timestamptz, attempt smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   record;
  v_last    record;
  v_wait    integer := coalesce(
    (select s.int_value from public.app_settings s where s.key = 'payment_retry_wait_seconds'), 180);
  v_expires timestamptz;
  v_attempt smallint;
  v_ref     text := 'luma_' || replace(gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  if not public.is_email_confirmed() then
    raise exception using errcode = 'P0001', message = 'email_not_confirmed';
  end if;
  if not (select c.enabled from public.payment_config() c) then
    raise exception using errcode = 'P0001', message = 'payments_disabled';
  end if;
  if p_environment is distinct from (case when (select c.sandbox from public.payment_config() c) then 'test' else 'prod' end) then
    raise exception using errcode = 'P0001', message = 'payments_misconfigured';
  end if;
  -- The order lock serialises two attempts prepared at the same time.
  select o.id, o.status, o.payment_method, o.payment_status, o.total_cop, o.created_at into v_order
  from public.orders o where o.id = p_order_id and o.user_id = auth.uid() for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'order_not_found';
  end if;
  if v_order.payment_status = 'approved' then
    raise exception using errcode = 'P0001', message = 'already_paid';
  end if;
  if v_order.payment_method <> 'online' or v_order.status <> 'awaiting_payment' then
    raise exception using errcode = 'P0001', message = 'order_not_payable';
  end if;
  v_expires := v_order.created_at + make_interval(mins => coalesce(
    (select s.int_value from public.app_settings s where s.key = 'payment_awaiting_expiry_minutes'), 15));
  if v_expires < now() + interval '1 minute' then
    raise exception using errcode = 'P0001', message = 'payment_expired';
  end if;
  select p.status, p.created_at into v_last from public.payments p
  where p.order_id = p_order_id order by p.attempt desc limit 1;
  if found and v_last.status = 'pending' and v_last.created_at > now() - make_interval(secs => v_wait) then
    raise exception using errcode = 'P0001', message = 'attempt_in_progress',
      hint = ceil(extract(epoch from v_last.created_at + make_interval(secs => v_wait) - now()))::integer::text;
  end if;
  select coalesce(max(p.attempt), 0) + 1 into v_attempt from public.payments p where p.order_id = p_order_id;
  if v_attempt > coalesce((select s.int_value from public.app_settings s where s.key = 'payment_max_attempts'), 3) then
    raise exception using errcode = 'P0001', message = 'too_many_attempts';
  end if;
  insert into public.payments (order_id, attempt, reference, environment, amount_in_cents, expires_at)
  values (p_order_id, v_attempt, v_ref, p_environment, v_order.total_cop::bigint * 100, v_expires);
  update public.orders set payment_status = 'pending' where id = p_order_id;
  return query select v_ref, v_order.total_cop::bigint * 100, 'COP'::text, v_expires, v_attempt;
end;
$$;

revoke execute on function public.prepare_payment(uuid, text) from public, anon;
grant execute on function public.prepare_payment(uuid, text) to authenticated;

-- 4. apply_payment_event --------------------------------------------------------------------------
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
  v_order_id uuid;
  v_payment  record;
  v_order    record;
  v_target   text := case p_status when 'APPROVED' then 'approved' when 'DECLINED' then 'declined'
                                   when 'ERROR' then 'error' when 'VOIDED' then 'voided' end;
  v_latest   boolean;
  v_paid     boolean;
  v_outcome  text;
begin
  if p_status not in ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR')
     or p_transaction_id !~ '^[0-9A-Za-z_-]{1,64}$' or p_source not in ('webhook', 'reconcile', 'void') then
    raise exception using errcode = '22023', message = 'invalid_event';
  end if;
  -- order_id and reference are immutable (payments_guard): safe to read before locking.
  select p.order_id into v_order_id from public.payments p where p.reference = p_reference;
  if v_order_id is null then
    insert into public.payment_events (provider_transaction_id, provider_status, amount_in_cents, source, outcome)
    values (p_transaction_id, p_status, coalesce(p_amount_in_cents, 0), p_source, 'unknown_reference')
    on conflict do nothing;
    return 'unknown_reference';
  end if;
  select o.id, o.status, o.total_cop, o.user_id into v_order from public.orders o where o.id = v_order_id for update;
  select * into v_payment from public.payments p where p.reference = p_reference for update;
  -- Checked under both locks, so two deliveries of one event cannot both pass.
  if exists (select 1 from public.payment_events e
             where e.provider_transaction_id = p_transaction_id and e.provider_status = p_status) then
    return 'duplicate';
  end if;

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
    v_paid := exists (select 1 from public.payments p
                      where p.order_id = v_order.id and p.id <> v_payment.id and p.status = 'approved');
    update public.payments p
    set status = v_target,
        approved_transaction_id = case when v_target = 'approved' then p_transaction_id else p.approved_transaction_id end,
        payment_method_type = coalesce(nullif(substring(upper(p_payment_method_type) from '^[A-Z_]{1,30}$'), ''),
                                       p.payment_method_type)
    where p.id = v_payment.id;
    if v_target = 'approved' and v_paid then
      -- Charged twice: this attempt is refunded; the order stays as the first payment left it.
      perform private.flag_payment_refund(v_payment.id, 'duplicate_charge');
    else
      if (v_target = 'approved' or v_latest) and not v_paid then
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

-- 5. payments_to_reconcile -------------------------------------------------------------------------
create or replace function public.payments_to_reconcile(p_min_age_seconds integer default 180, p_limit integer default 50)
returns table (payment_id uuid, reference text, transaction_id text, environment text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.reference, coalesce(p.approved_transaction_id, p.candidate_transaction_id), p.environment
  from public.payments p
  where ((p.status in ('pending', 'declined', 'error') and p.candidate_transaction_id is not null)
         or (p.status = 'pending' and p.candidate_transaction_id is null))
    and p.created_at < now() - make_interval(secs => greatest(coalesce(p_min_age_seconds, 180), 60))
    and p.created_at > now() - interval '2 days'
  order by p.created_at
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

revoke execute on function public.payments_to_reconcile(integer, integer) from public, anon, authenticated;
grant execute on function public.payments_to_reconcile(integer, integer) to service_role;

-- 6. Admin refunds ------------------------------------------------------------------------------------
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
  select p.approved_transaction_id, p.environment, p.payment_method_type, p.status, o.status as order_status
  into v_payment
  from public.payments p join public.orders o on o.id = p.order_id where p.id = p_payment_id;
  if not found or v_payment.approved_transaction_id is null
     or not (v_payment.status = 'refund_required'
             or (v_payment.status = 'approved' and v_payment.order_status = 'cancelled')) then
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
  select p.order_id into v_order from public.payments p where p.id = p_payment_id;
  perform 1 from public.orders o where o.id = v_order for update;
  update public.payments set status = 'refunded'
  where id = p_payment_id and status = 'refund_required' returning order_id into v_order;
  if not found then
    raise exception using errcode = 'P0001', message = 'payment_not_refundable';
  end if;
  -- An order still paid by another attempt (a duplicate charge) keeps its payment status.
  update public.orders o set payment_status = 'refunded'
  where o.id = v_order and not exists (
    select 1 from public.payments p where p.order_id = v_order and p.status in ('approved', 'refund_required'));
  insert into public.notifications (user_id, type, order_id, status)
  select o.user_id, 'payment', o.id, 'refunded' from public.orders o where o.id = v_order and o.user_id is not null;
  perform public.log_admin_action('mark_refund_done', 'payment', p_payment_id);
end;
$$;

revoke execute on function public.admin_mark_refund_done(uuid) from public, anon;
grant execute on function public.admin_mark_refund_done(uuid) to authenticated;

-- 7. Closed table, also for service_role ----------------------------------------------------------
revoke all on public.payments from service_role;

-- 8. Items of orders the business can see ---------------------------------------------------------
create or replace view public.business_order_items
  with (security_invoker = false, security_barrier = true)
as
select
  i.id,
  i.order_id,
  i.name,
  i.unit_price_cop,
  i.quantity,
  i.list_price_cop
from public.order_items i
join public.orders o on o.id = i.order_id
join public.businesses b on b.id = o.business_id
where b.owner_id = (select auth.uid()) and o.status <> 'awaiting_payment';

revoke all on public.business_order_items from public, anon, authenticated;
grant select on public.business_order_items to authenticated;

-- 9. NIT: only approved businesses of another owner block -----------------------------------------
create or replace function public.tax_id_taken(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_legal mine
    join public.businesses b on b.id = mine.business_id
    join public.business_legal other on public.digits_only(other.tax_id) = public.digits_only(mine.tax_id)
    join public.businesses ob on ob.id = other.business_id
    where mine.business_id = p_business_id
      and ob.owner_id <> b.owner_id
      and ob.verification_status = 'approved'
  )
$$;

revoke execute on function public.tax_id_taken(uuid) from public, anon, authenticated;

create or replace function public.review_business(
  p_business_id uuid, p_decision text, p_note text, p_seen_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_owner uuid;
  v_updated timestamptz;
  v_note text := nullif(btrim(p_note), '');
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  if p_decision not in ('approved', 'rejected', 'suspended') then
    raise exception using errcode = 'P0001', message = 'invalid_decision';
  end if;
  if p_decision in ('rejected', 'suspended') and v_note is null then
    raise exception using errcode = 'P0001', message = 'note_required';
  end if;
  select verification_status, owner_id, updated_at into v_status, v_owner, v_updated
  from public.businesses where id = p_business_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'business_not_found';
  end if;
  if v_updated is distinct from p_seen_updated_at then
    raise exception using errcode = 'P0001', message = 'stale_review';
  end if;
  if (v_status, p_decision) not in (
    ('pending', 'approved'), ('pending', 'rejected'), ('pending', 'suspended'),
    ('approved', 'suspended'), ('suspended', 'approved')
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_transition';
  end if;
  if p_decision = 'approved' and public.tax_id_taken(p_business_id) then
    raise exception using errcode = 'P0001', message = 'tax_id_in_use';
  end if;
  update public.businesses
  set verification_status = p_decision,
      verification_note = case when p_decision = 'approved' then null else left(v_note, 300) end,
      verified_at = case when p_decision = 'approved' then now() else verified_at end
  where id = p_business_id;
  insert into public.notifications (user_id, type, business_id, status)
  values (v_owner, 'business_review', p_business_id, p_decision);
  perform public.log_admin_action('review_business', 'business', p_business_id, p_decision);
end;
$$;

revoke execute on function public.review_business(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.review_business(uuid, text, text, timestamptz) to authenticated;

-- 10. Trigger functions are not RPCs ---------------------------------------------------------------
revoke execute on function public.set_updated_at() from public, anon, authenticated;
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    begin
      revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
    exception when insufficient_privilege then
      -- Owned by Supabase: listed as allowed in supabase/tests/function_privileges.sql.
      raise notice 'rls_auto_enable() belongs to another role; EXECUTE left as it is';
    end;
  end if;
end;
$$;

notify pgrst, 'reload schema';

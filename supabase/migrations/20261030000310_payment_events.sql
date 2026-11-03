-- -----------------------------------------------------------------------------
-- Migration: payment_events
--   1. payment_transition_allowed(from, to): the payment state machine. The
--      same vectors (supabase/tests/fixtures/payment_transitions.json) test
--      this function and PaymentStateMachine in TypeScript.
--        pending          -> approved | declined | error | voided
--        declined | error -> approved  (Wompi lets the customer retry the
--                                       same reference for 3 minutes)
--        approved         -> voided | refund_required
--        refund_required  -> refunded | voided
--      Same state to same state is a no-op handled by the caller. Nothing
--      leaves voided or refunded, and an approval never goes back.
--   2. payments: a trigger refuses invalid status changes and any DELETE.
--   3. payment_events: append only, unique per provider transaction and
--      status (idempotency). outcome says what the event did.
-- Depends on 20261030000300_payments_schema.sql.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

create or replace function public.payment_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('pending', 'approved'), ('pending', 'declined'), ('pending', 'error'), ('pending', 'voided'),
    ('declined', 'approved'), ('error', 'approved'),
    ('approved', 'voided'), ('approved', 'refund_required'),
    ('refund_required', 'refunded'), ('refund_required', 'voided')
  )
$$;

revoke execute on function public.payment_transition_allowed(text, text) from public, anon;
grant execute on function public.payment_transition_allowed(text, text) to authenticated, service_role;

create or replace function public.payments_status_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '42501', message = 'payment_immutable';
  end if;
  if new.status is distinct from old.status and not public.payment_transition_allowed(old.status, new.status) then
    raise exception using errcode = 'P0001', message = 'invalid_payment_transition';
  end if;
  return new;
end;
$$;

revoke execute on function public.payments_status_guard() from public, anon, authenticated;
drop trigger if exists payments_status_guard on public.payments;
create trigger payments_status_guard before update or delete on public.payments
  for each row execute function public.payments_status_guard();

-- 3. Events -----------------------------------------------------------------------------
create table if not exists public.payment_events (
  id                      bigint generated always as identity,
  payment_id              uuid        references public.payments (id) on delete restrict,
  provider_transaction_id text        not null
    constraint payment_events_transaction_shape check (provider_transaction_id ~ '^[0-9A-Za-z_-]{1,64}$'),
  provider_status         text        not null constraint payment_events_status_valid
    check (provider_status in ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR')),
  amount_in_cents         bigint      not null,
  source                  text        not null constraint payment_events_source_valid
    check (source in ('webhook', 'reconcile', 'void')),
  outcome                 text        not null constraint payment_events_outcome_valid
    check (outcome in ('applied', 'ignored', 'mismatch', 'unknown_reference')),
  created_at              timestamptz not null default now(),
  constraint payment_events_pkey primary key (id),
  constraint payment_events_once unique (provider_transaction_id, provider_status)
);

comment on table public.payment_events is 'Append-only log of payment events. No bodies, tokens or personal data.';
create index if not exists payment_events_payment_idx on public.payment_events (payment_id, created_at);
alter table public.payment_events enable row level security;
revoke all on public.payment_events from public, anon, authenticated, service_role;

create or replace function public.payment_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'payment_events_append_only';
end;
$$;

revoke execute on function public.payment_events_append_only() from public, anon, authenticated;
drop trigger if exists payment_events_append_only on public.payment_events;
create trigger payment_events_append_only before update or delete on public.payment_events
  for each row execute function public.payment_events_append_only();
drop trigger if exists payment_events_no_truncate on public.payment_events;
create trigger payment_events_no_truncate before truncate on public.payment_events
  for each statement execute function public.payment_events_append_only();

notify pgrst, 'reload schema';

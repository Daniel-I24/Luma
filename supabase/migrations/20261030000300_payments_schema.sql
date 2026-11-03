-- -----------------------------------------------------------------------------
-- Migration: payments_schema
-- Online payments through the Wompi hosted checkout. No card, PSE or Nequi
-- data ever reaches Luma: only references, transaction ids, amounts and
-- statuses. Only SECURITY DEFINER functions write these tables.
--   1. orders: payment_method 'online', status 'awaiting_payment' (invisible
--      to the business until paid), payment_status (none, pending, approved,
--      declined, voided, refund_required, refunded, error). No client grant
--      writes orders, so only functions change them.
--   2. payments: one row per checkout attempt (at most payment_max_attempts,
--      3). Closed table. A trigger keeps order_id, attempt, reference,
--      amount, currency, environment, gateway and created_at immutable and
--      lets approved_transaction_id be set only once.
--   3. payment_events: append only (REVOKE plus a trigger that refuses UPDATE,
--      DELETE and TRUNCATE for every role). One row per provider transaction
--      and status. Never the event body, tokens or personal data.
--   4. app_settings: payments_enabled (0: everything off), payments_production
--      (0 sandbox, 1 production; must match WOMPI_ENV), attempts and expiry.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

-- 1. Orders -------------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_payment_method_valid;
alter table public.orders add constraint orders_payment_method_valid
  check (payment_method in ('pay_at_pickup', 'online'));
alter table public.orders drop constraint if exists orders_status_valid;
alter table public.orders add constraint orders_status_valid check (
  status in ('awaiting_payment', 'pending', 'accepted', 'preparing', 'ready', 'picked_up', 'cancelled'));
alter table public.orders
  add column if not exists payment_status text not null default 'none'
    constraint orders_payment_status_valid check (payment_status in
      ('none', 'pending', 'approved', 'declined', 'voided', 'refund_required', 'refunded', 'error'));
create index if not exists orders_awaiting_payment_idx on public.orders (created_at) where status = 'awaiting_payment';

alter table public.notifications drop constraint if exists notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid check (type in
  ('order_status', 'order_new', 'order_cancelled', 'business_review', 'promotion', 'payment', 'review_invite'));
alter table public.notifications drop constraint if exists notifications_status_valid;
alter table public.notifications add constraint notifications_status_valid check (
  status is null or status in ('awaiting_payment', 'pending', 'accepted', 'preparing', 'ready', 'picked_up',
                               'cancelled', 'approved', 'rejected', 'suspended', 'declined', 'voided',
                               'refund_required', 'refunded', 'error'));

insert into public.app_settings (key, int_value) values
  ('payments_enabled', 0),
  ('payments_production', 0),
  ('payment_max_attempts', 3),
  ('payment_awaiting_expiry_minutes', 15)
on conflict (key) do nothing;

-- 2. Payments -----------------------------------------------------------------------
create table if not exists public.payments (
  id                      uuid        not null default gen_random_uuid(),
  order_id                uuid        not null references public.orders (id) on delete restrict,
  attempt                 smallint    not null constraint payments_attempt_range check (attempt between 1 and 10),
  reference               text        not null constraint payments_reference_shape check (reference ~ '^luma_[0-9a-f]{32}$'),
  gateway                 text        not null default 'wompi' constraint payments_gateway_valid check (gateway = 'wompi'),
  environment             text        not null constraint payments_environment_valid check (environment in ('test', 'prod')),
  amount_in_cents         bigint      not null constraint payments_amount_positive check (amount_in_cents > 0),
  currency                text        not null default 'COP' constraint payments_currency_cop check (currency = 'COP'),
  status                  text        not null default 'pending' constraint payments_status_valid check (status in
    ('pending', 'approved', 'declined', 'voided', 'refund_required', 'refunded', 'error')),
  approved_transaction_id text        constraint payments_transaction_shape
    check (approved_transaction_id is null or approved_transaction_id ~ '^[0-9A-Za-z_-]{1,64}$'),
  candidate_transaction_id text       constraint payments_candidate_shape
    check (candidate_transaction_id is null or candidate_transaction_id ~ '^[0-9A-Za-z_-]{1,64}$'),
  payment_method_type     text        constraint payments_method_shape
    check (payment_method_type is null or payment_method_type ~ '^[A-Z_]{1,30}$'),
  expires_at              timestamptz not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint payments_pkey primary key (id),
  constraint payments_reference_key unique (reference),
  constraint payments_order_attempt_key unique (order_id, attempt),
  constraint payments_approved_transaction_key unique (approved_transaction_id)
);

comment on table public.payments is 'Checkout attempts. No payment data: references, ids, amounts, statuses.';
comment on column public.payments.amount_in_cents is 'orders.total_cop * 100, fixed when the attempt is prepared.';
comment on column public.payments.candidate_transaction_id is 'Id from the redirect; untrusted until the API confirms it.';
create index if not exists payments_status_idx on public.payments (status, created_at);
alter table public.payments enable row level security;
revoke all on public.payments from public, anon, authenticated;

create or replace function public.payments_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.order_id, new.attempt, new.reference, new.gateway, new.environment, new.amount_in_cents, new.currency,
      new.created_at, new.expires_at)
     is distinct from (old.order_id, old.attempt, old.reference, old.gateway, old.environment, old.amount_in_cents,
                       old.currency, old.created_at, old.expires_at)
     or (old.approved_transaction_id is not null
         and new.approved_transaction_id is distinct from old.approved_transaction_id) then
    raise exception using errcode = '42501', message = 'payment_immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.payments_guard() from public, anon, authenticated;
drop trigger if exists payments_guard on public.payments;
create trigger payments_guard before update on public.payments
  for each row execute function public.payments_guard();

notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Push notifications: device tokens, preferences, notify_promotion, claim and
-- the pg_net poke. Roles: anon, customer (cus), owner, another owner (eve),
-- admin (adm), service_role. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

create function tests.token(p_name text) returns text language sql immutable
as $$ select 'fcm:' || replace(tests.id(p_name)::text, '-', '_') $$;
grant execute on function tests.token(text) to anon, authenticated;

-- -- device tokens -------------------------------------------------------------------
select tests.expect_error('anon', null,
  $$select public.register_device_token(tests.token('a'), 'android')$$, 'permission denied');
select tests.exec_as('authenticated', tests.id('cus'), $$select public.register_device_token(tests.token('cus'), 'android')$$);
select tests.expect_error('authenticated', tests.id('cus'), $$select * from public.device_tokens$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.register_device_token('short', 'android')$$, 'device_tokens_token_shape');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.register_device_token(tests.token('x') || ' <script>', 'android')$$, 'device_tokens_token_shape');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.register_device_token(tests.token('x'), 'ios')$$, 'device_tokens_platform_valid');
select tests.exec_as('authenticated', tests.id('eve'), $$select public.register_device_token(tests.token('shared'), 'web')$$);
select tests.exec_as('authenticated', tests.id('adm'), $$select public.register_device_token(tests.token('shared'), 'web')$$);
select tests.expect_true('postgres', null,
  $$select user_id = tests.id('adm') from public.device_tokens where token = tests.token('shared')$$,
  'a token signed in on another account moves to it');
select tests.exec_as('authenticated', tests.id('eve'), $$select public.unregister_device_token(tests.token('cus'))$$);
select tests.expect_true('postgres', null,
  $$select exists (select 1 from public.device_tokens where token = tests.token('cus'))$$,
  'nobody can unregister the token of another user');
select tests.exec_as('authenticated', tests.id('owner'), $$
  select public.register_device_token(tests.token('o' || n), 'android') from generate_series(1, 12) n$$);
select tests.expect_true('postgres', null,
  $$select count(*) = 10 from public.device_tokens where user_id = tests.id('owner')$$, 'at most 10 tokens per user');

-- -- preferences -----------------------------------------------------------------------
select tests.expect_true('postgres', null,
  $$select notify_orders and not notify_promotions from public.profiles where id = tests.id('cus')$$,
  'orders on, promotions off by default');
select tests.exec_as('authenticated', tests.id('cus'),
  $$update public.profiles set notify_promotions = true where id = tests.id('cus')$$);
select tests.exec_as('authenticated', tests.id('eve'),
  $$update public.profiles set notify_promotions = true where id = tests.id('eve')$$);
select tests.expect_true('authenticated', tests.id('eve'), $$
  with changed as (update public.profiles set notify_promotions = false where id = tests.id('cus') returning 1)
  select count(*) = 0 from changed$$, 'nobody changes the preferences of another user');

-- -- notify_promotion ------------------------------------------------------------------
insert into public.promotions (id, business_id, title, starts_at, ends_at) values
  (tests.id('p1'), tests.id('pub'), 'Hoy', now() - interval '1 hour', now() + interval '1 day'),
  (tests.id('p2'), tests.id('pub'), 'Otra', now() - interval '1 hour', now() + interval '1 day'),
  (tests.id('p3'), tests.id('pub'), 'Mañana', now() + interval '1 day', now() + interval '2 days'),
  (tests.id('p4'), tests.id('v1'), 'Borrador', now() - interval '1 hour', now() + interval '1 day');
insert into public.favorites (user_id, business_id) values
  (tests.id('cus'), tests.id('pub')), (tests.id('eve'), tests.id('pub')),
  (tests.id('adm'), tests.id('pub')), (tests.id('owner'), tests.id('pub'));

select tests.expect_error('authenticated', tests.id('eve'),
  $$select public.notify_promotion(tests.id('p1'))$$, 'not_business_owner');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.notify_promotion(tests.id('p1'))$$, 'not_business_owner');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.notify_promotion(tests.id('p4'))$$, 'business_not_public');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.notify_promotion(tests.id('p3'))$$, 'promotion_not_running');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select public.notify_promotion(tests.id('p1')) = 2$$,
  'only favourites who accepted promotions are told (not the owner, not adm)');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.notify_promotion(tests.id('p1'))$$, 'already_notified');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.notify_promotion(tests.id('p2'))$$, 'notify_limit');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select count(*) = 1 from public.notifications where type = 'promotion'$$, 'each user reads only their own');

-- -- claim_push_batch (service_role) ----------------------------------------------------
select tests.expect_error('authenticated', tests.id('owner'),
  $$select * from public.claim_push_batch(10)$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.remove_device_tokens(array[tests.token('cus')])$$, 'permission denied');
update public.profiles set notify_promotions = false where id = tests.id('eve');
select tests.expect_true('service_role', null, $$
  select count(*) = 1 and bool_and(tokens = array[tests.token('cus')] and business_name = 'Café Público')
  from public.claim_push_batch(100)$$,
  'only recipients with a token and consent at send time (eve withdrew, adm has no consent)');
select tests.expect_true('service_role', null,
  $$select count(*) = 0 from public.claim_push_batch(100)$$, 'a notification is pushed at most once');
select tests.expect_true('service_role', null,
  $$select public.remove_device_tokens(array[tests.token('cus')]) = 1$$, 'rejected tokens are removed');

-- -- poke via pg_net (stubbed here) -----------------------------------------------------
create schema net;
create table net.calls (url text, headers jsonb);
create function net.http_post(url text, body jsonb, headers jsonb) returns bigint language sql
as $$ insert into net.calls values (url, headers) returning 1::bigint $$;
grant usage on schema net to authenticated;
grant insert on net.calls to authenticated;
select tests.expect_true('authenticated', tests.id('cus'),
  $$select not exists (select 1 from information_schema.tables where table_schema = 'private')$$,
  'the private schema is invisible to clients');
insert into public.notifications (user_id, type, business_id, status)
values (tests.id('owner'), 'business_review', tests.id('pub'), 'approved');
select tests.expect_true('postgres', null, $$select count(*) = 0 from net.calls$$, 'no settings: no poke');
insert into private.push_settings (function_url, secret)
values ('https://x.supabase.co/functions/v1/push-dispatch', repeat('s', 40));
insert into public.notifications (user_id, type, business_id, status)
select tests.id('owner'), 'business_review', tests.id('pub'), 'approved' from generate_series(1, 3);
select tests.expect_true('postgres', null,
  $$select count(*) = 1 and bool_and(headers ->> 'x-push-secret' = repeat('s', 40)) from net.calls$$,
  'one poke per statement, with the shared secret');
create or replace function net.http_post(url text, body jsonb, headers jsonb) returns bigint language plpgsql
as $$ begin raise exception 'net down'; end $$;
insert into public.notifications (user_id, type, business_id, status)
values (tests.id('owner'), 'business_review', tests.id('pub'), 'approved');
select tests.expect_true('postgres', null,
  $$select count(*) = 5 from public.notifications where type = 'business_review' and user_id = tests.id('owner')$$,
  'a failed poke never blocks the notification');

rollback;

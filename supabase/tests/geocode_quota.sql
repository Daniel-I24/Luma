-- -----------------------------------------------------------------------------
-- geocode quota and cache TTL. Roles: anon, a customer (cus), an owner, an
-- admin (adm) and service_role. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

update public.app_settings set int_value = 2 where key = 'geocode_daily_per_user';
update public.app_settings set int_value = 3 where key = 'geocode_daily_global';

select tests.expect_error('anon', null, $$select public.consume_geocode_quota()$$, 'permission denied');
select tests.expect_true('authenticated', tests.id('cus'), $$
  select public.consume_geocode_quota() and public.consume_geocode_quota() and not public.consume_geocode_quota()$$,
  'a user gets the daily lookups, then false');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select public.consume_geocode_quota()$$, 'other users keep their own quota');
select tests.expect_true('authenticated', tests.id('adm'),
  $$select not public.consume_geocode_quota()$$, 'the global limit stops everyone, admins too');
select tests.expect_true('postgres', null, $$
  select (select calls from public.ai_usage where scope = 'geocode' and subject = tests.id('cus')) = 2
     and (select calls from public.ai_usage where scope = 'geocode_global') = 3
     and not exists (select 1 from public.ai_usage where scope = 'user' and subject = tests.id('cus'))$$,
  'refused lookups are not counted; geocoding does not use the AI quota');

update auth.users set email_confirmed_at = null where id = tests.id('eve');
update public.app_settings set int_value = 10 where key = 'geocode_daily_global';
select tests.expect_true('authenticated', tests.id('eve'),
  $$select public.consume_geocode_quota()$$, 'search works before confirming the email');

-- -- cache TTL: 7 days for geocode keys, 24 hours for the rest ---------------------
select tests.exec_as('service_role', null, $$select public.ai_cache_put('geocode:pasto-centro', '[]', 9999999)$$);
select tests.exec_as('service_role', null, $$select public.ai_cache_put('recommend:longttl', '{}', 9999999)$$);
select tests.expect_true('postgres', null, $$
  select (select expires_at from public.ai_cache where key = 'geocode:pasto-centro')
           between now() + interval '6 days 23 hours' and now() + interval '7 days'
     and (select expires_at from public.ai_cache where key = 'recommend:longttl') <= now() + interval '24 hours'$$,
  'geocode answers live up to 7 days, others 24 hours');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.ai_cache_put('geocode:planted', '[]', 600)$$, 'permission denied');

rollback;

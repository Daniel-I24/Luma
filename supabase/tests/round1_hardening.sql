-- -----------------------------------------------------------------------------
-- Round 1 hardening: claim_push_batch returns business_id, notify_promotion
-- recipient cap, handle_new_user never raises on odd metadata, devices need a
-- confirmed email. Roles: anon, customer (cus), owner, eve, unconfirmed
-- (unc), service_role. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

create function tests.token(p_name text) returns text language sql immutable
as $$ select 'fcm:' || replace(tests.id(p_name)::text, '-', '_') $$;
grant execute on function tests.token(text) to anon, authenticated;

-- -- handle_new_user with hostile metadata --------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  (tests.id('m1'), 'm1@test.local', '{"accepted_terms": "yes", "accepted_privacy": 1, "confirmed_age": "true"}'),
  (tests.id('m2'), 'm2@test.local', '{"full_name": 42, "phone": ["x"], "account_type": {"a": 1}}'),
  (tests.id('m3'), 'm3@test.local', '"just a string"'),
  (tests.id('m4'), 'm4@test.local', '{"accepted_terms": true, "terms_version": "2026-10", "full_name": "  Ana  "}');
select tests.expect_true('postgres', null, $$
  select count(*) = 4 from public.profiles where id in (tests.id('m1'), tests.id('m2'), tests.id('m3'), tests.id('m4'))$$,
  'odd sign-up metadata never blocks the sign-up');
select tests.expect_true('postgres', null, $$
  select terms_accepted_at is null and privacy_accepted_at is null and age_confirmed_at is null
  from public.profiles where id = tests.id('m1')$$,
  'only the JSON boolean true records a consent');
select tests.expect_true('postgres', null, $$
  select full_name is null and phone is null and account_type = 'customer' from public.profiles where id = tests.id('m2')$$,
  'non-string name, phone and type fall back to safe defaults');
select tests.expect_true('postgres', null, $$
  select full_name = 'Ana' and terms_accepted_at is not null and terms_version = '2026-10'
  from public.profiles where id = tests.id('m4')$$,
  'valid metadata is still copied');

-- -- register_device_token needs a confirmed email ------------------------------------
insert into auth.users (id, email, email_confirmed_at) values (tests.id('unc'), 'unc@test.local', null);
select tests.expect_error('authenticated', tests.id('unc'),
  $$select public.register_device_token(tests.token('unc'), 'android')$$, 'email_not_confirmed');
select tests.expect_error('anon', null,
  $$select public.register_device_token(tests.token('anon'), 'android')$$, 'permission denied');
select tests.exec_as('authenticated', tests.id('cus'), $$select public.register_device_token(tests.token('cus'), 'android')$$);
select tests.exec_as('authenticated', tests.id('owner'), $$select public.register_device_token(tests.token('owner'), 'android')$$);

-- -- notify_promotion recipient cap ----------------------------------------------------
update public.app_settings set int_value = 2 where key = 'promotion_notify_max_recipients';
insert into auth.users (id, email) select tests.id('f' || n), 'f' || n || '@test.local' from generate_series(1, 3) n;
update public.profiles set notify_promotions = true
where id in (tests.id('f1'), tests.id('f2'), tests.id('f3'), tests.id('cus'));
insert into public.favorites (user_id, business_id, created_at)
select tests.id('f' || n), tests.id('pub'), now() - make_interval(days => n) from generate_series(1, 3) n;
insert into public.favorites (user_id, business_id, created_at) values (tests.id('cus'), tests.id('pub'), now());
insert into public.promotions (id, business_id, title, starts_at, ends_at) values
  (tests.id('p1'), tests.id('pub'), 'Hoy', now() - interval '1 hour', now() + interval '1 day');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select public.notify_promotion(tests.id('p1')) = 2$$, 'at most promotion_notify_max_recipients users');
select tests.expect_true('postgres', null, $$
  select array_agg(user_id order by user_id) = array(select unnest(array[tests.id('cus'), tests.id('f1')]) order by 1)
  from public.notifications where promotion_id = tests.id('p1')$$,
  'the most recent favourites are told first');

-- -- claim_push_batch returns business_id ------------------------------------------------
insert into public.notifications (user_id, type, business_id, status)
values (tests.id('owner'), 'business_review', tests.id('pub'), 'approved');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select * from public.claim_push_batch(10)$$, 'permission denied');
select tests.expect_error('anon', null, $$select * from public.claim_push_batch(10)$$, 'permission denied');
select tests.expect_true('service_role', null, $$
  select count(*) = 2 and bool_and(business_id = tests.id('pub'))
  from public.claim_push_batch(100)$$,
  'promotion and review pushes carry the business id');

-- -- review_business compares updated_at to the microsecond ---------------------------
alter table public.businesses disable trigger businesses_set_updated_at;
update public.businesses set verification_status = 'pending', updated_at = '2026-10-19 12:00:00.123456+00'
where id = tests.id('v1');
alter table public.businesses enable trigger businesses_set_updated_at;
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.review_business(tests.id('v1'), 'approved', null, '2026-10-19T12:00:00.123Z')$$, 'stale_review');
select tests.exec_as('authenticated', tests.id('adm'),
  $$select public.review_business(tests.id('v1'), 'approved', null, '2026-10-19T12:00:00.123456+00:00')$$);
select tests.expect_true('postgres', null,
  $$select verification_status = 'approved' from public.businesses where id = tests.id('v1')$$,
  'the exact server string (microseconds) is accepted; a JS Date (milliseconds) is stale');

rollback;

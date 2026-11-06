-- -----------------------------------------------------------------------------
-- send_test_notification says whether the account has a device token, and
-- admin_push_health is for aal2 admins only (migration 59).
-- Roles: anon, customer, owner, admin. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

create function tests.admin_jwt() returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', tests.id('adm'), 'role', 'authenticated', 'aal', 'aal2')::text, true) $$;

select tests.expect_error('anon', null, $$select public.admin_push_health()$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('cus'), $$select public.admin_push_health()$$, 'not_admin');
select tests.expect_error('authenticated', tests.id('owner'), $$select public.admin_push_health()$$, 'not_admin');
select tests.expect_error('authenticated', tests.id('cus'), $$select public.send_test_notification()$$, 'not_admin');

delete from public.device_tokens where user_id = tests.id('adm');
select tests.expect_true('authenticated', tests.id('adm'),
  $$select public.send_test_notification() = false$$, 'without a device token the answer says so');

insert into public.device_tokens (token, user_id, platform)
values ('fcm:' || replace(tests.id('adm')::text, '-', '_'), tests.id('adm'), 'android');
select tests.expect_true('authenticated', tests.id('adm'),
  $$select public.send_test_notification() = true$$, 'with a device token the answer says so');

select tests.expect_true('authenticated', tests.id('adm'), $$
  select (public.admin_push_health() ->> 'tokens')::int >= 1
     and (public.admin_push_health() ->> 'unsent')::int >= 2$$, 'an admin reads the counts');
select tests.expect_true('authenticated', tests.id('adm'), $$
  select not public.admin_push_health() ?| array['token', 'tokens_list', 'user_id', 'secret']$$,
  'no token, user or secret in the answer');

rollback;

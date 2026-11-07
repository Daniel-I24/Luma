-- -----------------------------------------------------------------------------
-- A failed send is tried again, only for the failed phone, a limited number of
-- times, and admin_push_health reads only push-dispatch's answers (migrations 62
-- and 63). Roles: anon, owner, admin, service_role. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

delete from public.notifications;
create table tests.ids (name text primary key, id uuid);
with n as (
  insert into public.notifications (user_id, type, business_id, status)
  values (tests.id('owner'), 'business_review', tests.id('pub'), 'approved') returning id)
insert into tests.ids select 'notice', id from n;
create function tests.notice() returns uuid language sql stable security definer as $$ select id from tests.ids where name = 'notice' $$;
create function tests.make_due() returns void language sql as $$ update private.push_retries set retry_at = now() - interval '1 second' $$;
insert into public.device_tokens (token, user_id, platform) values
  ('fcm:phone_a_0000000000', tests.id('owner'), 'android'), ('fcm:phone_b_0000000000', tests.id('owner'), 'android');

-- -- Who may call it ---------------------------------------------------------------------
select tests.expect_error('anon', null, $$select public.schedule_push_retry(tests.notice(), array['x'], 0)$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('owner'), $$select public.schedule_push_retry(tests.notice(), array['x'], 0)$$, 'permission denied');
select tests.expect_error('anon', null, $$select * from public.claim_push_retries(10)$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('owner'), $$select * from public.claim_push_retries(10)$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('owner'), $$select * from private.push_retries$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('owner'), $$select * from private.push_requests$$, 'permission denied');

-- -- Only the failed phone, and not before its time ------------------------------------------
select tests.expect_true('service_role', null,
  $$select public.schedule_push_retry(tests.notice(), array['fcm:phone_a_0000000000'], 0) = 1$$, 'the failed phone is scheduled');
select tests.expect_true('postgres', null,
  $$select retry_at between now() + interval '50 seconds' and now() + interval '70 seconds' and attempt = 1 from private.push_retries$$,
  'first wait: one minute');
select tests.expect_true('service_role', null,
  $$select count(*) = 0 from public.claim_push_retries(10)$$, 'not due yet: nothing is claimed');
select tests.expect_true('postgres', null, $$select not private.push_work_pending()
   or exists (select 1 from public.notifications where pushed_at is null)$$, 'a retry not yet due does not wake the cron by itself');

select tests.make_due();
select tests.expect_true('postgres', null, $$select private.push_work_pending()$$, 'a due retry wakes the cron');
select tests.expect_true('service_role', null, $$
  select count(*) = 1 and bool_and(tokens = array['fcm:phone_a_0000000000']) and bool_and(attempt = 1) and bool_and(type = 'business_review')
  from public.claim_push_retries(10)$$, 'it goes only to the failed phone, with the notice text data');
select tests.expect_true('postgres', null, $$select count(*) = 0 from private.push_retries$$, 'claimed once');
select tests.expect_true('service_role', null, $$select count(*) = 0 from public.claim_push_retries(10)$$, 'and never twice');

-- -- The attempts end --------------------------------------------------------------------
select tests.expect_true('service_role', null, $$select public.schedule_push_retry(tests.notice(), array['fcm:phone_a_0000000000'], 1) = 1$$, 'second retry');
select tests.expect_true('postgres', null,
  $$select retry_at > now() + interval '4 minutes' and attempt = 2 from private.push_retries$$, 'second wait: five minutes');
select tests.expect_true('service_role', null, $$select public.schedule_push_retry(tests.notice(), array['fcm:phone_a_0000000000'], 2) = 1$$, 'third retry');
select tests.expect_true('postgres', null,
  $$select retry_at > now() + interval '14 minutes' and attempt = 3 from private.push_retries$$, 'third wait: fifteen minutes');
delete from private.push_retries;
select tests.expect_true('service_role', null, $$select public.schedule_push_retry(tests.notice(), array['fcm:phone_a_0000000000'], 3) = 0$$, 'a fourth is refused');
select tests.expect_true('postgres', null, $$select count(*) = 0 from private.push_retries$$, 'nothing stays');

-- -- What changed since it failed --------------------------------------------------------
select public.schedule_push_retry(tests.notice(), array['fcm:phone_a_0000000000', 'fcm:phone_b_0000000000'], 0);
delete from public.device_tokens where token = 'fcm:phone_b_0000000000';
select tests.make_due();
select tests.expect_true('service_role', null, $$
  select count(*) = 1 and bool_and(tokens = array['fcm:phone_a_0000000000']) from public.claim_push_retries(10)$$, 'a removed phone is not tried');

update public.notifications set type = 'promotion', status = null where id = tests.notice();
update public.profiles set notify_promotions = false where id = tests.id('owner');
select public.schedule_push_retry(tests.notice(), array['fcm:phone_a_0000000000'], 0);
select tests.make_due();
select tests.expect_true('service_role', null, $$select count(*) = 0 from public.claim_push_retries(10)$$, 'consent refused meanwhile: not sent');
update public.profiles set notify_promotions = true where id = tests.id('owner');

select public.schedule_push_retry(tests.notice(), array['fcm:phone_a_0000000000'], 0);
update public.notifications set created_at = now() - interval '61 minutes' where id = tests.notice();
select tests.make_due();
select tests.expect_true('service_role', null, $$select count(*) = 0 from public.claim_push_retries(10)$$, 'out of the window: old news is not sent');
select tests.expect_true('postgres', null, $$select count(*) = 0 from private.push_retries$$, 'and it is forgotten');

-- -- admin_push_health reads only push-dispatch ----------------------------------------------
create function tests.admin_jwt() returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', tests.id('adm'), 'role', 'authenticated', 'aal', 'aal2')::text, true) $$;
create schema net;
create table net._http_response (id bigint primary key, status_code integer, content text, error_msg text, created timestamptz default now());
create sequence net.ids;
create function net.http_post(url text, body jsonb, headers jsonb) returns bigint language sql as $$ select nextval('net.ids') $$;
insert into private.push_settings (function_url, secret) values ('https://x.test/push', repeat('s', 40))
on conflict (id) do nothing;

insert into public.notifications (user_id, type) values (tests.id('adm'), 'test');
select tests.expect_true('postgres', null, $$select count(*) = 1 from private.push_requests$$, 'a poke records its request id');

insert into net._http_response (id, status_code, content, created)
  select request_id, 200, '{"sent":1}', now() - interval '1 minute' from private.push_requests;
insert into net._http_response (id, status_code, content, created) values (9000, 500, '{"reconciled":0}', now());
select tests.expect_true('authenticated', tests.id('adm'), $$
  select (public.admin_push_health() ->> 'status')::int = 200
     and public.admin_push_health() ->> 'body' = '{"sent":1}'
     and public.admin_push_health() ? 'at'$$, 'the payments cron answer is not shown as the push server');
select tests.expect_error('authenticated', tests.id('owner'), $$select public.admin_push_health()$$, 'not_admin');

rollback;

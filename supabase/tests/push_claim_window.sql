-- -----------------------------------------------------------------------------
-- claim_push_batch (migration 58): a notice waits for a user without a token,
-- within a window that keeps old notices from being sent, and the cron only
-- wakes up with work. Roles: anon, owner, service_role. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

delete from public.notifications;
create function tests.notice(p_user text, p_age interval) returns uuid language sql as $$
  insert into public.notifications (user_id, type, business_id, status, created_at)
  values (tests.id(p_user), 'business_review', tests.id('pub'), 'approved', now() - p_age)
  returning id $$;
create function tests.pushed(p_id uuid) returns boolean language sql stable as $$
  select pushed_at is not null from public.notifications where id = p_id $$;
create table tests.ids (name text primary key, id uuid);

-- -- Who may call it ---------------------------------------------------------------------
select tests.expect_error('anon', null, $$select * from public.claim_push_batch(10)$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select * from public.claim_push_batch(10)$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select private.push_work_pending()$$, 'permission denied');

-- -- Without a token the notice waits --------------------------------------------------
insert into tests.ids values ('waiting', tests.notice('owner', interval '5 minutes'));
select tests.expect_true('postgres', null,
  $$select not private.push_work_pending()$$, 'a notice waiting for a token does not wake the cron');
select tests.expect_true('service_role', null,
  $$select count(*) = 0 from public.claim_push_batch(100)$$, 'nothing to send without a token');
select tests.expect_true('postgres', null,
  $$select not tests.pushed((select id from tests.ids where name = 'waiting'))$$,
  'a notice of a user without a token is not consumed');

-- -- The token arrives: it goes out, once --------------------------------------------------
insert into public.device_tokens (token, user_id, platform)
values ('fcm:' || replace(tests.id('owner')::text, '-', '_'), tests.id('owner'), 'android');
select tests.expect_true('postgres', null,
  $$select private.push_work_pending()$$, 'a linked token wakes the cron');
select tests.expect_true('service_role', null, $$
  select count(*) = 1 and bool_and(cardinality(tokens) = 1) from public.claim_push_batch(100)$$,
  'once the phone links its token the notice is sent');
select tests.expect_true('service_role', null,
  $$select count(*) = 0 from public.claim_push_batch(100)$$, 'and it is sent only once');

-- -- Older than the window: consumed, never sent --------------------------------------------
insert into tests.ids values ('old_with_token', tests.notice('owner', interval '61 minutes'));
insert into tests.ids values ('old_no_token', tests.notice('eve', interval '2 hours'));
select tests.expect_true('postgres', null,
  $$select private.push_work_pending()$$, 'an old notice wakes the cron once, to be marked');
select tests.expect_true('service_role', null,
  $$select count(*) = 0 from public.claim_push_batch(100)$$, 'an old notice is never sent');
select tests.expect_true('postgres', null,
  $$select not private.push_work_pending()$$, 'and then there is no work left');
select tests.expect_true('postgres', null, $$
  select tests.pushed((select id from tests.ids where name = 'old_with_token'))
     and tests.pushed((select id from tests.ids where name = 'old_no_token'))$$,
  'old notices are marked, with or without a token, so they stop being scanned');

-- -- The window is a setting -----------------------------------------------------------------
update public.app_settings set int_value = 5 where key = 'push_claim_window_minutes';
insert into tests.ids values ('short', tests.notice('owner', interval '6 minutes'));
select tests.expect_true('service_role', null,
  $$select count(*) = 0 from public.claim_push_batch(100)$$, 'a shorter window is respected');
update public.app_settings set int_value = 60 where key = 'push_claim_window_minutes';

-- -- Refused consent still consumes the notice -------------------------------------------
with created as (
  insert into public.notifications (user_id, type, business_id)
  values (tests.id('owner'), 'promotion', tests.id('pub'))
  returning id
)
insert into tests.ids select 'promo', id from created;
update public.profiles set notify_promotions = false where id = tests.id('owner');
select tests.expect_true('service_role', null,
  $$select count(*) = 0 from public.claim_push_batch(100)$$, 'no consent: it is not sent');
select tests.expect_true('postgres', null,
  $$select tests.pushed((select id from tests.ids where name = 'promo'))$$,
  'and it is not kept to send later');

rollback;

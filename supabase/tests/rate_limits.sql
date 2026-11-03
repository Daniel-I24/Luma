-- -----------------------------------------------------------------------------
-- Rate limits: hit_rate_limit(bucket). Roles: anon, customer (cus), owner,
-- unconfirmed (unc). Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql
insert into auth.users (id, email, email_confirmed_at) values (tests.id('unc'), 'unc@test.local', null);
update public.app_settings set int_value = 2 where key = 'rate_menu_scan_max';

select tests.expect_error('anon', null, $$select public.hit_rate_limit('menu_scan')$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('unc'),
  $$select public.hit_rate_limit('menu_scan')$$, 'email_not_confirmed');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.hit_rate_limit('no_such_bucket')$$, 'unknown_rate_limit');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.hit_rate_limit('Menu-Scan; drop table x')$$, 'unknown_rate_limit');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select public.hit_rate_limit('menu_scan') and public.hit_rate_limit('menu_scan')$$, 'hits within the window pass');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select not public.hit_rate_limit('menu_scan')$$, 'the hit over the limit is refused');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select public.hit_rate_limit('menu_scan')$$, 'each user has their own bucket');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select * from public.rate_limit_hits$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('cus'),
  $$delete from public.rate_limit_hits$$, 'permission denied');

-- An old window is forgotten and deleted.
update public.rate_limit_hits set window_start = window_start - interval '1 day' where user_id = tests.id('cus');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select public.hit_rate_limit('menu_scan')$$, 'a new window starts again');
select tests.expect_true('postgres', null,
  $$select count(*) = 1 from public.rate_limit_hits where user_id = tests.id('cus')$$, 'old windows of the caller are deleted');

rollback;

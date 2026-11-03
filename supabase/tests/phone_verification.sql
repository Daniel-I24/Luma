-- -----------------------------------------------------------------------------
-- Phone verification (migration 20261031000000): off by default nothing
-- changes; with require_phone_verification = 1, create_order,
-- become_business_owner and submit_business_for_review refuse with
-- 'phone_not_verified' and profiles.phone only changes to the phone
-- confirmed in auth.users (sync_verified_phone). Roles: anon, customer
-- (cus), owner of v1 (owner). Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql
select tests.complete_profile('cus');
select tests.complete_profile('owner');

-- -- off (default): nothing changes ---------------------------------------------------
do $$ begin
  if (select int_value from public.app_settings where key = 'require_phone_verification') <> 0 then
    raise exception 'require_phone_verification must be 0 by default';
  end if;
end $$;
select tests.exec_as('authenticated', tests.id('cus'),
  $$update public.profiles set phone = '+573004445566' where id = tests.id('cus')$$);
select tests.expect_true('authenticated', tests.id('cus'),
  $$select phone = '+573004445566' from public.profiles where id = tests.id('cus')$$,
  'off: the user edits the mobile freely');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select (public.submit_business_for_review(tests.id('v1')) ->> 'ok') is not null$$,
  'off: submitting for review does not check the phone');

-- -- on: everything that matters needs the verified phone ------------------------------
update public.app_settings set int_value = 1 where key = 'require_phone_verification';
update public.businesses set verification_status = 'draft' where id = tests.id('v1');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.submit_business_for_review(tests.id('v1'))$$, 'phone_not_verified');
update public.profiles set account_type = 'customer' where id = tests.id('cus');
select tests.expect_error('authenticated', tests.id('cus'), $$select public.become_business_owner()$$,
  'phone_not_verified');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.create_order(tests.id('v1'), jsonb_build_array(jsonb_build_object('menu_item_id', tests.id('mv1'), 'quantity', 1)), null, null, 'pay_at_pickup')$$,
  'phone_not_verified');

-- the profile phone cannot be changed by hand
select tests.expect_error('authenticated', tests.id('cus'),
  $$update public.profiles set phone = '+573007778899' where id = tests.id('cus')$$, 'phone_not_verified');
select tests.expect_error('authenticated', tests.id('cus'), $$select public.sync_verified_phone()$$,
  'phone_not_verified');

-- after the code check (auth.users.phone confirmed) the verified phone is copied
update auth.users set phone = '573007778899', phone_confirmed_at = now() where id = tests.id('cus');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select public.sync_verified_phone() = '+573007778899'$$, 'sync copies the confirmed phone');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select public.is_phone_verified() and public.phone_check_passed()$$, 'and the check passes');
select tests.expect_error('authenticated', tests.id('cus'),
  $$update public.profiles set phone = '+573001112233' where id = tests.id('cus')$$, 'phone_not_verified');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select public.become_business_owner() = 'business_owner'$$, 'a verified phone may register a business');

-- -- abuse: anon has no access ------------------------------------------------------
select tests.expect_error('anon', null, $$select public.sync_verified_phone()$$, 'permission denied');
select tests.expect_error('anon', null, $$select public.verified_auth_phone()$$, 'permission denied');

rollback;

-- -----------------------------------------------------------------------------
-- Account types and private profile data. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql

-- -- profiles from the sign-up metadata (never blocks a sign-up) ----------------
insert into auth.users (id, email, raw_user_meta_data) values
  (tests.id('own'), 'own@test.local',
   '{"account_type": "business_owner", "full_name": "  Ana Pérez ", "phone": "+57 300 123 4567",
     "accepted_terms": true, "terms_version": "2026-10"}'),
  (tests.id('cus'), 'cus@test.local', '{"account_type": "admin", "phone": "12345", "accepted_terms": "yes"}'),
  (tests.id('long'), 'long@test.local', jsonb_build_object('full_name', repeat('x', 81), 'phone', '3001234567')),
  (tests.id('none'), 'none@test.local', null),
  (tests.id('junk'), 'junk@test.local', '[1, 2, 3]');

select tests.expect_true('authenticated', tests.id('own'),
  $$select account_type = 'business_owner' and full_name = 'Ana Pérez' and phone = '+573001234567'
       and consented_at is not null and terms_version = '2026-10'
    from public.profiles where id = tests.id('own')$$, 'valid metadata is copied and normalised');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select account_type = 'customer' and phone is null and consented_at is null
    from public.profiles where id = tests.id('cus')$$,
  'unknown type, bad phone and non-boolean consent fall back to safe defaults');
select tests.expect_true('authenticated', tests.id('long'),
  $$select full_name is null and phone = '+573001234567' from public.profiles where id = tests.id('long')$$,
  'a too long name is ignored, a bare mobile is normalised');
select tests.expect_true('authenticated', tests.id('none'),
  $$select account_type = 'customer' from public.profiles where id = tests.id('none')$$, 'no metadata');
select tests.expect_true('authenticated', tests.id('junk'),
  $$select account_type = 'customer' from public.profiles where id = tests.id('junk')$$, 'non-object metadata');

-- -- what a user may change -------------------------------------------------------
select tests.exec_as('authenticated', tests.id('cus'), $$
  update public.profiles set display_name = 'Cami', full_name = 'Camila Ruiz', phone = '+573109876543',
    onboarding_seen_version = 1 where id = tests.id('cus')$$);
select tests.expect_true('authenticated', tests.id('cus'),
  $$select display_name = 'Cami' and onboarding_seen_version = 1 from public.profiles where id = tests.id('cus')$$,
  'own display name, name, phone and onboarding version are editable');
select tests.expect_error('authenticated', tests.id('cus'),
  $$update public.profiles set account_type = 'business_owner' where id = tests.id('cus')$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('cus'),
  $$update public.profiles set consented_at = now() where id = tests.id('cus')$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('cus'),
  $$update public.profiles set terms_version = 'x' where id = tests.id('cus')$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('cus'),
  $$update public.profiles set phone = '6012345678' where id = tests.id('cus')$$, 'profiles_phone_co_mobile');
select tests.exec_as('authenticated', tests.id('cus'),
  $$update public.profiles set full_name = 'Hacked' where id = tests.id('own')$$);

-- -- privacy: nobody else reads a profile ---------------------------------------
select tests.expect_true('authenticated', tests.id('cus'),
  $$select count(*) = 0 from public.profiles where id = tests.id('own')$$, 'other profiles are invisible');
select tests.expect_true('authenticated', tests.id('own'),
  $$select full_name = 'Ana Pérez' from public.profiles where id = tests.id('own')$$,
  'another user could not change it');
select tests.expect_error('anon', null, $$select count(*) from public.profiles$$, 'permission denied');
select tests.expect_true('authenticated', tests.id('own'),
  $$select count(*) = 0 from information_schema.columns
    where table_schema = 'public' and table_name in ('reviews_with_author', 'business_orders', 'business_order_items')
      and column_name in ('full_name', 'phone', 'account_type', 'email')$$,
  'no public or business view exposes private profile data');

-- -- customer -> business owner, one way --------------------------------------
select tests.expect_error('anon', null, $$select public.become_business_owner()$$, 'permission denied');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select public.become_business_owner() = 'business_owner'$$, 'a customer becomes a business owner');
select tests.expect_true('authenticated', tests.id('own'),
  $$select public.become_business_owner() = 'business_owner'$$, 'an owner stays an owner');

-- -- only owners create businesses, at most 3 -----------------------------------
select tests.expect_error('authenticated', tests.id('none'), $$
  insert into public.businesses (owner_id, name, category, latitude, longitude, address)
  values (tests.id('none'), 'Not allowed', 'Bar', 1.21, -77.28, 'Calle 1 # 1-1')$$, 'not_business_owner');
select tests.exec_as('authenticated', tests.id('own'), $$
  insert into public.businesses (owner_id, name, category, latitude, longitude, address)
  select tests.id('own'), 'Negocio ' || n, 'Bar', 1.21, -77.28, 'Calle 1 # 1-1' from generate_series(1, 3) n$$);
select tests.expect_error('authenticated', tests.id('own'), $$
  insert into public.businesses (owner_id, name, category, latitude, longitude, address)
  values (tests.id('own'), 'Cuarto', 'Bar', 1.21, -77.28, 'Calle 1 # 1-1')$$, 'business_limit_reached');
select tests.expect_true('anon', null,
  $$select not has_function_privilege('anon', 'public.handle_new_user()', 'execute')
       and not has_function_privilege('authenticated', 'public.businesses_owner_limits()', 'execute')$$,
  'trigger functions are not callable by clients');

rollback;

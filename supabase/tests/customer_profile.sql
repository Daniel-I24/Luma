-- -----------------------------------------------------------------------------
-- Customer profile: residence, is_profile_complete, phone verification,
-- become_business_owner, private avatars (Storage policies, set_avatar,
-- business access only while serving the customer). Roles: anon, customer
-- (cus), unconfirmed (unc), owner of pub (owner), another owner (eve).
-- Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql
insert into auth.users (id, email) values (tests.id('new'), 'new@test.local');
insert into auth.users (id, email, email_confirmed_at) values (tests.id('unc'), 'unc@test.local', null);

-- -- residence and completeness -----------------------------------------------------
select tests.expect_true('authenticated', tests.id('new'), $$select not public.is_profile_complete()$$,
  'a new account is not complete');
select tests.expect_error('authenticated', tests.id('new'),
  $$update public.profiles set residence_dane_code = '52001' where id = tests.id('new')$$, 'profiles_residence_together');
select tests.expect_error('authenticated', tests.id('new'), $$update public.profiles
  set residence_dane_code = '5200', residence_city = 'Pasto', residence_department = 'Nariño' where id = tests.id('new')$$,
  'profiles_residence_dane_code_shape');
select tests.expect_error('authenticated', tests.id('new'),
  $$update public.profiles set residence_neighborhood = repeat('x', 61) where id = tests.id('new')$$,
  'profiles_residence_neighborhood_length');
select tests.exec_as('authenticated', tests.id('new'), $$update public.profiles
  set residence_dane_code = '52001', residence_city = 'Pasto', residence_department = 'Nariño',
      residence_neighborhood = 'Las Cuadras', full_name = 'Ana Pérez', phone = '+573001234567'
  where id = tests.id('new')$$);
select tests.expect_true('authenticated', tests.id('new'), $$select public.is_profile_complete()$$,
  'name, mobile and municipality make it complete');
select tests.expect_true('authenticated', tests.id('eve'), $$
  with changed as (update public.profiles set residence_city = 'Ipiales' where id = tests.id('new') returning 1)
  select count(*) = 0 from changed$$, 'nobody edits the residence of another user');
select tests.expect_error('authenticated', tests.id('new'),
  $$update public.profiles set avatar_path = null, strikes_cleared_at = now() where id = tests.id('new')$$,
  'permission denied');
select tests.expect_error('anon', null, $$select public.is_profile_complete()$$, 'permission denied');

-- -- become_business_owner needs a complete profile -------------------------------------
insert into auth.users (id, email) values (tests.id('bare'), 'bare@test.local');
select tests.expect_error('authenticated', tests.id('bare'), $$select public.become_business_owner()$$, 'profile_incomplete');
select tests.expect_true('authenticated', tests.id('new'), $$select public.become_business_owner() = 'business_owner'$$,
  'a complete profile may register a business');

-- -- phone verification (off by default) ------------------------------------------------
select tests.expect_true('authenticated', tests.id('cus'),
  $$select not public.is_phone_verified() and public.phone_check_passed()$$, 'off by default: unverified passes');
update public.app_settings set int_value = 1 where key = 'require_phone_verification';
select tests.expect_true('authenticated', tests.id('cus'), $$select not public.phone_check_passed()$$,
  'required: an unverified phone fails');
update auth.users set phone = '573009998877', phone_confirmed_at = now() where id = tests.id('cus');
select tests.expect_true('authenticated', tests.id('cus'), $$select not public.is_phone_verified()$$,
  'a verified phone that is not the profile phone does not count');
update auth.users set phone = '573001112233' where id = tests.id('cus');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select public.is_phone_verified() and public.phone_check_passed()$$, 'the verified profile phone passes');
update public.profiles set account_type = 'customer' where id = tests.id('eve');
select tests.expect_error('authenticated', tests.id('eve'), $$select public.become_business_owner()$$, 'phone_not_verified');
update public.app_settings set int_value = 0 where key = 'require_phone_verification';

-- -- avatars ------------------------------------------------------------------------------
create function tests.avatar(p_name text) returns text language sql immutable
as $$ select tests.id(p_name)::text || '/avatar/' || tests.id('file-' || p_name)::text || '.webp' $$;
grant execute on function tests.avatar(text) to authenticated;

select tests.expect_error('authenticated', tests.id('unc'),
  $$insert into storage.objects (bucket_id, name) values ('avatars', tests.avatar('unc'))$$, 'row-level security');
select tests.expect_error('authenticated', tests.id('cus'),
  $$insert into storage.objects (bucket_id, name) values ('avatars', tests.avatar('eve'))$$, 'row-level security');
select tests.expect_error('authenticated', tests.id('cus'),
  $$insert into storage.objects (bucket_id, name) values ('avatars', tests.id('cus')::text || '/avatar/x.gif')$$,
  'row-level security');
select tests.exec_as('authenticated', tests.id('cus'),
  $$insert into storage.objects (bucket_id, name) values ('avatars', tests.avatar('cus'))$$);
select tests.expect_error('authenticated', tests.id('cus'),
  $$insert into storage.objects (bucket_id, name) values ('avatars', tests.id('cus')::text || '/avatar/' || tests.id('x')::text || '.png')$$,
  'row-level security');
select tests.expect_true('postgres', null,
  $$select not public from storage.buckets where id = 'avatars'$$, 'the avatars bucket is private');

select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.set_avatar(tests.avatar('cus'), false)$$, 'avatar_consent_required');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.set_avatar(tests.avatar('eve'), true)$$, 'avatar_not_found');
select tests.exec_as('authenticated', tests.id('cus'), $$select public.set_avatar(tests.avatar('cus'), true)$$);
select tests.expect_true('postgres', null, $$
  select avatar_path = tests.avatar('cus') and avatar_consent_at is not null and not show_avatar_to_business
  from public.profiles where id = tests.id('cus')$$, 'set_avatar records the consent; sharing stays off');

-- The owner of pub sees it only while serving an order of cus, with sharing on.
insert into public.orders (id, user_id, business_id, business_name, business_address, total_cop, status)
values (tests.id('o1'), tests.id('cus'), tests.id('pub'), 'Café Público', 'Calle 19', 2000, 'pending');
create function tests.sees_avatar() returns boolean language sql
as $$ select exists (select 1 from storage.objects where bucket_id = 'avatars' and name = tests.avatar('cus')) $$;
grant execute on function tests.sees_avatar() to authenticated;
select tests.expect_true('authenticated', tests.id('owner'), $$select not tests.sees_avatar()$$, 'pending order: hidden');
update public.orders set status = 'accepted' where id = tests.id('o1');
select tests.expect_true('authenticated', tests.id('owner'), $$select not tests.sees_avatar()$$, 'sharing off: hidden');
update public.profiles set show_avatar_to_business = true where id = tests.id('cus');
select tests.expect_true('authenticated', tests.id('owner'), $$select tests.sees_avatar()$$, 'accepted and shared: visible');
select tests.expect_true('authenticated', tests.id('eve'), $$select not tests.sees_avatar()$$, 'another owner never sees it');
select tests.expect_true('anon', null, $$select not exists (select 1 from storage.objects where bucket_id = 'avatars')$$,
  'anon sees no avatar');
update public.orders set status = 'picked_up' where id = tests.id('o1');
select tests.expect_true('authenticated', tests.id('owner'), $$select not tests.sees_avatar()$$, 'picked up: hidden again');
select tests.expect_true('authenticated', tests.id('owner'), $$
  with gone as (delete from storage.objects where bucket_id = 'avatars' returning 1) select count(*) = 0 from gone$$,
  'only the user deletes their photo');
select tests.exec_as('authenticated', tests.id('cus'), $$select public.set_avatar(null, null)$$);
select tests.expect_true('postgres', null, $$
  select avatar_path is null and avatar_consent_at is null and not show_avatar_to_business
  from public.profiles where id = tests.id('cus')$$, 'clearing the photo turns sharing off');

rollback;

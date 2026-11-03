-- What the legacy rows look like after every pending migration (rehearsal.sh).
\set ON_ERROR_STOP on
begin;
\ir ../_helpers.sql

select tests.expect_true('postgres', null, $$
  select count(*) = 2 and bool_and(verification_status = 'approved') from public.businesses$$,
  'existing businesses stay visible (approved)');
select tests.expect_true('postgres', null, $$
  select count(*) = 2 and bool_and(notify_orders and not notify_promotions)
     and bool_and(account_type = case when id = '00000000-0000-4000-8000-0000000000a1'::uuid
                                      then 'business_owner' else 'customer' end)
  from public.profiles$$, 'owners of existing businesses become owners, others customers; promotions opt-in');
select tests.expect_true('postgres', null, $$
  select terms_accepted_at is null and privacy_accepted_at is null from public.profiles limit 1$$,
  'no consent is invented for existing users');
select tests.expect_true('anon', null, $$
  select count(*) = 2 from public.businesses$$, 'anon still sees both legacy businesses');
select tests.expect_true('anon', null, $$
  select count(*) = 1 from public.menu_items$$, 'and their available menu');
select tests.expect_true('postgres', null, $$
  select count(*) = 1 from public.reviews$$, 'reviews survive');
select tests.expect_true('authenticated', '00000000-0000-4000-8000-0000000000a2'::uuid, $$
  select count(*) = 1 from public.favorites$$, 'favourites survive and stay private');
select tests.expect_true('postgres', null, $$
  select count(*) >= 10 from pg_constraint where contype = 'c' and not convalidated$$,
  'new constraints on old tables are NOT VALID (validated later)');
-- Legacy users who never confirmed their email can read but not write.
select tests.expect_error('authenticated', '00000000-0000-4000-8000-0000000000a2'::uuid, $$
  insert into public.reviews (business_id, rating) values ('00000000-0000-4000-8000-0000000000b1', 4)$$,
  'email_not_confirmed');
select tests.expect_error('authenticated', '00000000-0000-4000-8000-0000000000a1'::uuid, $$
  insert into public.reviews (business_id, rating) values ('00000000-0000-4000-8000-0000000000b1', 4)$$,
  'row-level security');

rollback;

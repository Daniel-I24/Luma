-- -----------------------------------------------------------------------------
-- export_my_data: only the caller's own data. Roles: anon, customer (cus),
-- owner, another owner (eve), admin (adm). Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

insert into public.orders (id, user_id, business_id, business_name, business_address, total_cop, status, notes) values
  (tests.id('o1'), tests.id('cus'), tests.id('pub'), 'Café Público', 'Calle 19', 4000, 'picked_up', 'sin azucar'),
  (tests.id('o2'), tests.id('eve'), tests.id('pub'), 'Café Público', 'Calle 19', 2000, 'pending', 'nota de eve');
insert into public.order_items (order_id, menu_item_id, name, unit_price_cop, list_price_cop, quantity) values
  (tests.id('o1'), tests.id('mpub'), 'Tinto', 2000, 2000, 2);
insert into public.favorites (user_id, business_id) values (tests.id('cus'), tests.id('pub')), (tests.id('eve'), tests.id('pub'));
insert into public.reviews (business_id, user_id, rating, comment) values
  (tests.id('pub'), tests.id('cus'), 5, 'Rico'), (tests.id('pub'), tests.id('eve'), 1, 'review de eve');
insert into public.device_tokens (token, user_id, platform) values ('fcm_token_of_cus_0000000000', tests.id('cus'), 'android');
select tests.expect_error('anon', null, $$select public.export_my_data()$$, 'permission denied');
select tests.expect_true('authenticated', tests.id('cus'), $$
  with e as (select public.export_my_data() as d)
  select d -> 'account' ->> 'email' = 'cus@test.local'
     and jsonb_array_length(d -> 'orders') = 1
     and d -> 'orders' -> 0 -> 'items' -> 0 ->> 'name' = 'Tinto'
     and jsonb_array_length(d -> 'favorites') = 1
     and jsonb_array_length(d -> 'reviews') = 1
     and (d ->> 'devices')::int = 1
     and jsonb_array_length(d -> 'businesses') = 0
  from e$$, 'a customer gets their own orders, favourites, reviews and device count');
select tests.expect_true('authenticated', tests.id('cus'), $$
  select position('eve' in public.export_my_data()::text) = 0
     and position('fcm_token_of_cus' in public.export_my_data()::text) = 0$$,
  'nothing of other users, and never the device tokens');
select tests.expect_true('authenticated', tests.id('owner'), $$
  with e as (select public.export_my_data() as d)
  select jsonb_array_length(d -> 'businesses') = 2
     and jsonb_array_length(d -> 'orders') = 0
     and position('sin azucar' in d::text) = 0 and position('cus@test.local' in d::text) = 0
  from e$$, 'an owner gets their businesses but never the orders or data of their customers');
select tests.expect_true('authenticated', tests.id('cus'), $$
  with e as (select public.export_my_data() as d)
  select d -> 'favorites' -> 0 ? 'business' and not d -> 'favorites' -> 0 ? 'business_id'
     and d -> 'reviews' -> 0 ? 'business' and not d -> 'reviews' -> 0 ? 'business_id'
     and d -> 'orders' -> 0 ? 'business' and not d -> 'orders' -> 0 ? 'id'
     and not d -> 'account' ? 'id' and not d -> 'profile' ? 'id' and not d -> 'profile' ? 'avatar_path'
  from e$$, 'businesses by name, and no internal ids');
update public.ai_usage set calls = 10 where scope = 'export' and subject = tests.id('cus');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.export_my_data()$$, 'export_limit');

rollback;

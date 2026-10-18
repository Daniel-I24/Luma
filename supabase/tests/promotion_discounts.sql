-- -----------------------------------------------------------------------------
-- Promotions with a discount and server-side prices in create_order.
-- Roles: anon, a customer (cus), the owner of pub, another owner (eve) and an
-- admin (adm). Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

-- pub (owner, public, open 24/7): Tinto 2000 (fixture), Empanada 9990, Jugo 5000.
-- eve owns an approved business with its own item.
insert into public.menu_items (id, business_id, name, price_cop) values
  (tests.id('emp'), tests.id('pub'), 'Empanada', 9990),
  (tests.id('jugo'), tests.id('pub'), 'Jugo', 5000);
insert into public.businesses (id, owner_id, name, category, latitude, longitude, address, is_active) values
  (tests.id('eve-biz'), tests.id('eve'), 'Eve Bar', 'Bar', 1.21, -77.28, 'Calle 5 # 1-1', true);
update public.businesses set verification_status = 'approved' where id = tests.id('eve-biz');
insert into public.menu_items (id, business_id, name, price_cop) values
  (tests.id('eve-item'), tests.id('eve-biz'), 'Cerveza', 6000);

-- -- owners create discounts on their own items only -------------------------------
select tests.exec_as('authenticated', tests.id('owner'), $$
  insert into public.promotions (business_id, title, starts_at, ends_at, menu_item_id, discount_percent) values
    (tests.id('pub'), 'Tinto 10%', now() - interval '1 hour', now() + interval '1 day', tests.id('mpub'), 10),
    (tests.id('pub'), 'Tinto 25%', now() - interval '1 hour', now() + interval '2 days', tests.id('mpub'), 25),
    (tests.id('pub'), 'Empanada 15%', now() - interval '1 hour', now() + interval '1 day', tests.id('emp'), 15)$$);
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 3 from public.promotions where business_id = tests.id('pub') and discount_percent is not null$$,
  'owner creates discounts on their items');
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.promotions (business_id, title, starts_at, ends_at, discount_percent)
  values (tests.id('pub'), 'Sin item', now(), now() + interval '1 day', 20)$$, 'promotions_discount_needs_item');
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.promotions (business_id, title, starts_at, ends_at, menu_item_id, discount_percent)
  values (tests.id('pub'), 'Demasiado', now(), now() + interval '1 day', tests.id('jugo'), 95)$$, 'promotions_discount_range');
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.promotions (business_id, title, starts_at, ends_at, menu_item_id, discount_percent)
  values (tests.id('pub'), 'Muy poco', now(), now() + interval '1 day', tests.id('jugo'), 4)$$, 'promotions_discount_range');
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.promotions (business_id, title, starts_at, ends_at, menu_item_id, discount_percent)
  values (tests.id('pub'), 'Ajeno', now(), now() + interval '1 day', tests.id('eve-item'), 20)$$, 'promotion_item_mismatch');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.promotions set menu_item_id = tests.id('eve-item') where title = 'Empanada 15%'$$,
  'promotion_item_mismatch');
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.promotions (business_id, title, starts_at, ends_at, menu_item_id, discount_percent)
  values (tests.id('pub'), 'Al reves', now(), now() - interval '1 day', tests.id('jugo'), 20)$$, 'promotions_dates_order');
-- Abuse: another owner, a customer and an admin cannot add promotions to pub.
select tests.expect_error('authenticated', tests.id('eve'), $$
  insert into public.promotions (business_id, title, starts_at, ends_at, menu_item_id, discount_percent)
  values (tests.id('pub'), 'Robo', now(), now() + interval '1 day', tests.id('jugo'), 50)$$, 'row-level security');
select tests.expect_error('authenticated', tests.id('cus'), $$
  insert into public.promotions (business_id, title, starts_at, ends_at)
  values (tests.id('pub'), 'Cliente', now(), now() + interval '1 day')$$, 'row-level security');
select tests.expect_true('authenticated', tests.id('adm'), $$
  with changed as (update public.promotions set discount_percent = 90 where title = 'Tinto 10%' returning 1)
  select count(*) = 0 from changed$$, 'an admin changes no promotion');
select tests.expect_error('anon', null, $$
  insert into public.promotions (business_id, title, starts_at, ends_at)
  values (tests.id('pub'), 'Anon', now(), now() + interval '1 day')$$, 'permission denied');

-- -- at most 5 active promotions per business ---------------------------------------
select tests.exec_as('authenticated', tests.id('owner'), $$
  insert into public.promotions (business_id, title, starts_at, ends_at) values
    (tests.id('pub'), 'Cuarta', now(), now() + interval '1 day'),
    (tests.id('pub'), 'Quinta', now(), now() + interval '1 day')$$);
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.promotions (business_id, title, starts_at, ends_at)
  values (tests.id('pub'), 'Sexta', now(), now() + interval '1 day')$$, 'promotion_limit');
select tests.expect_true('authenticated', tests.id('owner'), $$
  with ended as (
    insert into public.promotions (business_id, title, starts_at, ends_at, is_active)
    values (tests.id('pub'), 'Pausada', now(), now() + interval '1 day', false) returning 1)
  select count(*) = 1 from ended$$, 'paused or ended promotions do not count towards the limit');

-- -- visibility ------------------------------------------------------------------------
insert into public.promotions (business_id, title, starts_at, ends_at, menu_item_id, discount_percent) values
  (tests.id('pub'), 'Vencida', now() - interval '3 days', now() - interval '1 day', tests.id('jugo'), 50),
  (tests.id('v1'), 'Negocio no publico', now() - interval '1 hour', now() + interval '1 day', tests.id('mv1'), 30);
select tests.expect_true('anon', null,
  $$select count(*) = 0 from public.promotions where title in ('Vencida', 'Negocio no publico')$$,
  'expired promotions and those of non-public businesses are hidden');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select count(*) = 3 from public.promotions where discount_percent is not null$$,
  'customers see current discounts of public businesses');

-- -- create_order applies the best current promotion ----------------------------------
select tests.exec_as('authenticated', tests.id('cus'), $$
  select public.create_order(tests.id('pub'), jsonb_build_array(
    jsonb_build_object('menu_item_id', tests.id('mpub'), 'quantity', 2, 'unit_price_cop', 1),
    jsonb_build_object('menu_item_id', tests.id('emp'), 'quantity', 1, 'price_cop', 10),
    jsonb_build_object('menu_item_id', tests.id('jugo'), 'quantity', 1)))$$);
select tests.expect_true('authenticated', tests.id('cus'), $$
  select (select array_agg(row(name, list_price_cop, unit_price_cop, quantity)::text order by name)
          from public.order_items) = array['(Empanada,9990,8492,1)', '(Jugo,5000,5000,1)', '(Tinto,2000,1500,2)']$$,
  'best discount per item, rounded to the peso, list price kept, client prices ignored');
select tests.expect_true('authenticated', tests.id('cus'), $$
  select (select total_cop from public.orders) = 1500 * 2 + 8492 + 5000
     and (select promotion_id from public.order_items where name = 'Tinto') = (select id from public.promotions where title = 'Tinto 25%')
     and (select promotion_id from public.order_items where name = 'Jugo') is null$$,
  'the total is the sum of final prices and each line records its promotion');
select tests.expect_true('authenticated', tests.id('owner'), $$
  select count(*) = 3 and bool_and(list_price_cop >= unit_price_cop) from public.business_order_items$$,
  'the owner sees list and final prices of the lines');

-- A promotion attached to another business's item never applies (the trigger
-- forbids creating one; bypass it here to check create_order on its own).
alter table public.promotions disable trigger promotions_guard;
insert into public.promotions (business_id, title, starts_at, ends_at, is_active, menu_item_id, discount_percent)
values (tests.id('eve-biz'), 'Cruzada', now() - interval '1 hour', now() + interval '1 day', true, tests.id('jugo'), 90);
alter table public.promotions enable trigger promotions_guard;
select tests.exec_as('authenticated', tests.id('cus'), $$
  select public.create_order(tests.id('pub'), jsonb_build_array(jsonb_build_object('menu_item_id', tests.id('jugo'), 'quantity', 1)))$$);
select tests.expect_true('authenticated', tests.id('cus'),
  $$select count(*) = 2 and bool_and(unit_price_cop = 5000) from public.order_items where name = 'Jugo'$$,
  'expired promotions and promotions of other businesses are ignored');

-- Items of another business are rejected; the pricing function is internal.
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.create_order(tests.id('pub'), jsonb_build_array(jsonb_build_object('menu_item_id', tests.id('eve-item'), 'quantity', 1)))$$,
  'item_unavailable');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select * from public.order_line_prices(tests.id('pub'), '[]'::jsonb, now())$$, 'permission denied');
select tests.expect_error('anon', null,
  $$select public.promotion_price(1000, 10::smallint)$$, 'permission denied');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select public.promotion_price(9990, 15::smallint) = 8492 and public.promotion_price(1001, 50::smallint) = 501
       and public.promotion_price(2000, null) = 2000$$,
  'rounding: nearest peso, halves up');

rollback;

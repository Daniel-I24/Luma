-- -----------------------------------------------------------------------------
-- Realtime event tables (20261106000000_round9.sql, part 3): which changes make
-- an event, who reads order_events (customer, owner, nobody else), that clients
-- cannot write events, the pruning and the publication.
-- Roles: owner (pub approved, v1 draft), eve (another owner), cus and cus2
-- (customers), anon. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql
insert into auth.users (id, email) values (tests.id('cus2'), 'cus2@test.local');
select tests.complete_profile('cus2');

create function tests.events(p_business text, p_kind text) returns bigint language sql stable as $$
  select count(*) from public.catalog_events where business_id = tests.id(p_business) and kind = p_kind $$;
grant execute on function tests.events(text, text) to anon, authenticated;
delete from public.catalog_events;
delete from public.order_events;

-- 1. Catalog: public businesses and their parts only --------------------------------------
select tests.exec_as('authenticated', tests.id('owner'), $$update public.businesses set description = 'Tinto y pan de yuca' where id = tests.id('pub')$$);
select tests.expect_true('anon', null, $$select tests.events('pub', 'business') = 1$$, 'editing a public business makes one event, readable by anon');
select tests.exec_as('authenticated', tests.id('owner'), $$update public.businesses set name = 'Fritanga Renovada' where id = tests.id('v1')$$);
select tests.expect_true('anon', null, $$select tests.events('v1', 'business') = 0$$, 'a draft never makes events');
select tests.exec_as('authenticated', tests.id('owner'), $$update public.menu_items set price_cop = 2500 where id = tests.id('mpub')$$);
select tests.exec_as('authenticated', tests.id('owner'), $$update public.menu_items set is_available = false where id = tests.id('mpub')$$);
select tests.expect_true('anon', null, $$select tests.events('pub', 'menu') = 2$$, 'a price and a sold-out product of a public business');
select tests.exec_as('authenticated', tests.id('owner'), $$update public.menu_items set price_cop = 19000 where id = tests.id('mv1')$$);
select tests.expect_true('anon', null, $$select tests.events('v1', 'menu') = 0$$, 'the menu of a draft makes no events');
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.business_hours set closes_at = '22:00' where business_id = tests.id('pub') and day_of_week = 1$$);
select tests.expect_true('anon', null, $$select tests.events('pub', 'hours') = 1$$, 'an hours change');
select tests.exec_as('authenticated', tests.id('owner'), $$
  insert into public.promotions (business_id, title, starts_at, ends_at)
  values (tests.id('pub'), 'Dos por uno', now(), now() + interval '2 days')$$);
select tests.expect_true('anon', null, $$select tests.events('pub', 'promotion') = 1$$, 'a new promotion');
select tests.exec_as('authenticated', tests.id('owner'), $$update public.businesses set is_active = false where id = tests.id('pub')$$);
select tests.expect_true('anon', null, $$select tests.events('pub', 'business') = 2$$, 'pausing makes an event so open screens drop it');
select tests.exec_as('authenticated', tests.id('owner'), $$update public.menu_items set price_cop = 3000 where id = tests.id('mpub')$$);
select tests.expect_true('anon', null, $$select tests.events('pub', 'menu') = 2$$, 'a paused business makes no more menu events');
select tests.exec_as('authenticated', tests.id('owner'), $$update public.menu_items set is_available = true where id = tests.id('mpub')$$);
select tests.exec_as('authenticated', tests.id('owner'), $$update public.businesses set is_active = true where id = tests.id('pub')$$);

-- 2. Events carry ids and a time only, and only triggers write them ------------------------
select tests.expect_true('postgres', null, $$
  select array_agg(column_name::text order by column_name) = array['at', 'business_id', 'id', 'kind']
  from information_schema.columns where table_schema = 'public' and table_name = 'catalog_events'$$, 'catalog_events: ids, kind and time');
select tests.expect_true('postgres', null, $$
  select array_agg(column_name::text order by column_name) = array['at', 'business_id', 'id', 'order_id', 'user_id']
  from information_schema.columns where table_schema = 'public' and table_name = 'order_events'$$, 'order_events: ids and time');
select tests.expect_error('anon', null, $$insert into public.catalog_events (kind, business_id) values ('menu', tests.id('pub'))$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('cus'),
  $$insert into public.order_events (order_id, user_id) values (gen_random_uuid(), tests.id('cus'))$$, 'permission denied');
select tests.expect_error('anon', null, $$select count(*) from public.order_events$$, 'permission denied');

-- 3. Orders: the customer and the owner, nobody else ----------------------------------------
select tests.exec_as('authenticated', tests.id('cus'),
  $$select public.create_order(tests.id('pub'), jsonb_build_array(tests.line_of('mpub', 1)))$$);
create function tests.order_events_seen() returns bigint language sql stable as $$
  select count(*) from public.order_events where order_id is not null $$;
grant execute on function tests.order_events_seen() to authenticated;
select tests.expect_true('authenticated', tests.id('cus'), $$select tests.order_events_seen() >= 1$$, 'the customer sees the event of their order');
select tests.expect_true('authenticated', tests.id('owner'), $$select tests.order_events_seen() >= 1$$, 'the owner sees the new order of their business');
select tests.expect_true('authenticated', tests.id('eve'), $$select tests.order_events_seen() = 0$$, 'another owner sees nothing');
select tests.expect_true('authenticated', tests.id('cus2'), $$select tests.order_events_seen() = 0$$, 'another customer sees nothing');
select tests.exec_as('authenticated', tests.id('owner'), format('select public.set_order_status(%L, %L, null)',
  (select id from public.orders where business_id = tests.id('pub')), 'accepted'));
select tests.expect_true('authenticated', tests.id('cus'), $$select tests.order_events_seen() >= 2$$, 'a status change reaches the customer');
select tests.expect_true('authenticated', tests.id('cus2'), $$select tests.order_events_seen() = 0$$, 'and still nobody else');

-- 4. Notifications: "your inbox changed", for its owner only ---------------------------------
delete from public.order_events;
insert into public.notifications (user_id, type) values (tests.id('cus2'), 'test');
select tests.expect_true('authenticated', tests.id('cus2'), $$
  select count(*) = 1 from public.order_events where order_id is null$$, 'a new notification tells its owner');
select tests.expect_true('authenticated', tests.id('cus'), $$select count(*) = 0 from public.order_events$$, 'nobody else hears of it');

-- 5. Pruning and publication -------------------------------------------------------------
insert into public.catalog_events (kind, business_id, at) values ('menu', tests.id('pub'), now() - interval '2 days');
select private.prune_realtime_events();
select tests.expect_true('postgres', null, $$
  select not exists (select 1 from public.catalog_events where at < now() - interval '1 day')$$, 'events older than a day are pruned');
select tests.expect_true('postgres', null, $$
  select array_agg(tablename::text order by tablename) = array['catalog_events', 'order_events']
  from pg_publication_tables where pubname = 'supabase_realtime'$$, 'the publication carries exactly the two event tables');

rollback;

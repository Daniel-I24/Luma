-- -----------------------------------------------------------------------------
-- Query plans of the busiest reads (round 10, phase 5 performance): with
-- sequential scans discouraged, each read can use its index. The data is tiny,
-- so this checks that an index fits the query, not timings.
--   - the customer's orders (newest first, 50): orders_user_idx
--   - the business board: orders_business_idx
--   - the map's bounding box: businesses_lat_idx / businesses_lng_idx
-- Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
set local enable_seqscan = off;

create function tests.plan(p_sql text) returns text language plpgsql as $$
declare
  line text;
  result text := '';
begin
  for line in execute 'explain ' || p_sql loop
    result := result || line || E'\n';
  end loop;
  return result;
end $$;

select tests.expect_true('postgres', null, $$
  select tests.plan('select id from public.orders where user_id = ''00000000-0000-4000-8000-000000000001'' order by created_at desc limit 50')
    like '%orders_user_idx%'$$, 'customer orders: orders_user_idx (user, newest first)');
select tests.expect_true('postgres', null, $$
  select tests.plan('select id from public.orders where business_id = ''00000000-0000-4000-8000-000000000002'' order by created_at desc limit 50')
    like '%orders_business_idx%'$$, 'business board: orders_business_idx');
select tests.expect_true('postgres', null, $$
  select tests.plan('select id from public.businesses where latitude between 1.1 and 1.3 and longitude between -77.4 and -77.2')
    ~ 'businesses_(lat|lng)_idx'$$, 'map bounding box: a coordinate index');

rollback;

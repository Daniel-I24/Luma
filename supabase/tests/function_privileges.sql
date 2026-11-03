-- -----------------------------------------------------------------------------
-- Function privileges (20261101000000_round4_hardening.sql): anon may execute
-- no function of public except is_business_public(uuid) (used by the RLS
-- policies anon reads through) and the allow-list below. Trigger functions
-- are not RPCs, and the triggers still run without that grant.
-- Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _orders_fixtures.sql

-- Allowed for anon besides is_business_public(uuid):
--   rls_auto_enable(): created by Supabase in hosted projects (event trigger
--   function owned by supabase_admin). The migration revokes EXECUTE when its
--   role may; when it may not, it stays here. It does not exist locally.
create temporary table allowed_for_anon (signature text primary key);
insert into allowed_for_anon values ('is_business_public(uuid)'), ('rls_auto_enable()');

select tests.expect_true('postgres', null, $$
  select coalesce(string_agg(p.oid::regprocedure::text, ', '), '') = ''
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
    and regexp_replace(p.oid::regprocedure::text, '^public\.', '') not in (select signature from allowed_for_anon)$$,
  'anon executes no other function of public');
select tests.expect_true('postgres', null, $$
  select not has_function_privilege('authenticated', 'public.set_updated_at()', 'execute')
     and not has_function_privilege('anon', 'public.set_updated_at()', 'execute')$$,
  'set_updated_at() is not an RPC');
select tests.expect_error('authenticated', tests.id('ana'), $$select public.set_updated_at()$$, 'permission denied');

-- The triggers that use it still work for the roles that update the rows.
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.businesses set name = 'Test Fritanga 2' where id = tests.id('b1')$$);
select tests.expect_true('postgres', null, $$
  select name = 'Test Fritanga 2' and updated_at > now() - interval '1 minute' from public.businesses where id = tests.id('b1')$$,
  'businesses_set_updated_at still runs for the owner');

rollback;

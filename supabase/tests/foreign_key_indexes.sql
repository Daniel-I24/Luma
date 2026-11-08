-- -----------------------------------------------------------------------------
-- 20261116000000_foreign_key_indexes.sql: every single-column foreign key of the
-- public schema has an index that starts with it, so deleting a parent row never
-- reads a whole child table. A new foreign key without one fails here.
-- Role: postgres. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql

select tests.expect_true('postgres', null, $$
  select not exists (
    select 1
    from pg_constraint c
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and array_length(c.conkey, 1) = 1
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
  )$$, 'every public foreign key is indexed');

select tests.expect_true('postgres', null, $$
  select count(*) = 7 from pg_indexes
  where schemaname = 'public' and indexname in (
    'notifications_business_id_idx', 'notifications_order_id_idx', 'notifications_promotion_id_idx',
    'order_items_menu_item_id_idx', 'order_items_promotion_id_idx', 'rate_limit_hits_user_id_idx',
    'reports_business_id_idx')$$, 'the seven indexes of migration 66 exist');

rollback;

-- -----------------------------------------------------------------------------
-- Run in the Supabase SQL editor AFTER applying the migrations and BEFORE
-- validating the NOT VALID constraints (docs/migrations.md). Lists, for each
-- constraint that is not validated yet, how many rows break it. Fix or
-- delete those rows, then run the VALIDATE commands. Read only.
-- -----------------------------------------------------------------------------
create or replace function pg_temp.luma_validate_report()
returns table (table_name text, constraint_name text, failing_rows bigint)
language plpgsql
as $$
declare
  c record;
begin
  for c in
    select con.conrelid::regclass::text as tbl, con.conname as name,
           substring(pg_get_constraintdef(con.oid) from '^CHECK \((.*)\)( NOT VALID)?$') as expr
    from pg_constraint con
    join pg_namespace n on n.oid = con.connamespace
    where n.nspname = 'public' and con.contype = 'c' and not con.convalidated
    order by 1, 2
  loop
    table_name := c.tbl;
    constraint_name := c.name;
    execute format('select count(*) from %s where not (%s)', c.tbl, c.expr) into failing_rows;
    return next;
  end loop;
end;
$$;

select * from pg_temp.luma_validate_report();

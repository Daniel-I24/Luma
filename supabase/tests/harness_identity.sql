-- -----------------------------------------------------------------------------
-- Self-test of the test helpers: after every check (passed or failed) the
-- runner is back to its own role with no JWT, so no identity leaks.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql

create function tests.assert_restored(p_label text)
returns void
language plpgsql
as $$
begin
  if current_user <> session_user or auth.uid() is not null
     or coalesce(current_setting('request.jwt.claims', true), '') <> '' then
    raise exception 'FAIL identity leaked after %: user %, uid %', p_label, current_user, auth.uid();
  end if;
  raise notice 'ok  [harness] identity restored after %', p_label;
end;
$$;

select tests.exec_as('authenticated', tests.id('ana'), $$select 1$$);
select tests.assert_restored('exec_as');
select tests.expect_true('authenticated', tests.id('ana'), $$select auth.uid() = tests.id('ana')$$, 'auth.uid() is the JWT sub');
select tests.assert_restored('expect_true');
select tests.expect_error('authenticated', tests.id('ana'), $$select 1 / 0$$, 'division by zero');
select tests.assert_restored('a failing statement');
select tests.expect_true('anon', null, $$select auth.uid() is null and current_user = 'anon'$$, 'anon has no uid');
select tests.assert_restored('anon');

rollback;

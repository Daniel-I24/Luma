-- ─────────────────────────────────────────────────────────────────────────────
-- Test helpers (loaded with \i by the test files, inside their transaction).
-- They run a statement as a Supabase role (anon / authenticated) with a JWT
-- `sub` claim, the way PostgREST does, and assert the outcome.
-- ─────────────────────────────────────────────────────────────────────────────

create schema tests;

-- Runs p_sql as p_role with auth.uid() = p_sub (null: no claim).
create function tests.exec_as(p_role text, p_sub uuid, p_sql text)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_sub::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role)::text, true);
  execute format('set local role %I', p_role);
  execute p_sql;
  reset role;
end;
$$;

-- Fails unless p_sql raises an error whose message contains p_expected.
create function tests.expect_error(p_role text, p_sub uuid, p_sql text, p_expected text)
returns void
language plpgsql
as $$
declare
  v_failed boolean := false;
begin
  begin
    perform tests.exec_as(p_role, p_sub, p_sql);
  exception when others then
    v_failed := true;
    if sqlerrm not like '%' || p_expected || '%' then
      raise exception 'FAIL [%] expected "%" but got "%": %', p_role, p_expected, sqlerrm, p_sql;
    end if;
  end;
  reset role;
  if not v_failed then
    raise exception 'FAIL [%] expected "%" but it succeeded: %', p_role, p_expected, p_sql;
  end if;
  raise notice 'ok  [%] % → %', p_role, left(regexp_replace(p_sql, '\s+', ' ', 'g'), 70), p_expected;
end;
$$;

-- Fails unless the boolean query p_check is true when run as p_role.
create function tests.expect_true(p_role text, p_sub uuid, p_check text, p_label text)
returns void
language plpgsql
as $$
declare
  v_result boolean;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_sub::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role)::text, true);
  execute format('set local role %I', p_role);
  execute p_check into v_result;
  reset role;
  if v_result is distinct from true then
    raise exception 'FAIL [%] %: % returned %', p_role, p_label, p_check, v_result;
  end if;
  raise notice 'ok  [%] %', p_role, p_label;
end;
$$;

grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- Fixed ids for the fixtures.
create function tests.id(p_name text)
returns uuid
language sql
immutable
as $$ select md5('luma-test-' || p_name)::uuid $$;
grant execute on function tests.id(text) to anon, authenticated;

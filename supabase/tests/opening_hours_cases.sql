-- -----------------------------------------------------------------------------
-- public.business_open_at against the cases shared with the app's
-- OpeningHours (supabase/tests/fixtures/opening_hours_cases.json).
-- The JSON comes in the psql variable "cases":
--   psql -v cases="$(cat supabase/tests/fixtures/opening_hours_cases.json)" -f ...
-- supabase/tests/local/run.sh passes it. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql

insert into auth.users (id, email) values (tests.id('hours-owner'), 'hours@test.local');

create temp table hour_cases as
  select ordinality as n, value as c
  from jsonb_array_elements((:'cases')::jsonb -> 'cases') with ordinality;
grant select on hour_cases to anon;

do $$
declare
  r record;
  v_business uuid;
  v_at timestamptz;
  v_open boolean;
begin
  for r in select * from hour_cases order by n loop
    v_business := gen_random_uuid();
    insert into public.businesses (id, owner_id, name, category, latitude, longitude, address, is_active)
    values (v_business, tests.id('hours-owner'), 'Case ' || r.n, 'Bar', 1.21, -77.28, 'Calle 1 # 1-1', true);
    insert into public.business_hours (business_id, day_of_week, opens_at, closes_at, is_closed)
    select v_business, (h ->> 'day')::int, (h ->> 'opens')::time, (h ->> 'closes')::time,
           coalesce((h ->> 'closed')::boolean, false)
    from jsonb_array_elements(r.c -> 'hours') h;
    -- 2026-10-11 is a Sunday (day 0); the case time is local Bogota time.
    v_at := (date '2026-10-11' + (r.c -> 'at' ->> 'day')::int + (r.c -> 'at' ->> 'time')::time)
            at time zone 'America/Bogota';
    v_open := public.business_open_at(v_business, v_at);
    if v_open is distinct from (r.c ->> 'open')::boolean then
      raise exception 'FAIL [hours] %: expected open = %, got %', r.c ->> 'name', r.c ->> 'open', v_open;
    end if;
    raise notice 'ok  [hours] %', r.c ->> 'name';
  end loop;
end;
$$;

select tests.expect_true('anon', null,
  $$select (select count(*) from hour_cases) >= 20$$, 'every shared case ran');

rollback;

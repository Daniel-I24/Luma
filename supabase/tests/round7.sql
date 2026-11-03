-- -----------------------------------------------------------------------------
-- Round 7 (20261104000000_round7.sql): businesses per owner, validation rules
-- shared with the app (fixtures/validation_vectors.json, psql variable
-- validation_vectors from run.sh) and the CHECK constraints that use them.
-- Roles: owner and eve (owners), cus (customer), new accounts for the limit.
-- Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql
select tests.use_aal('aal2');
create table tests.vectors (doc jsonb);
insert into tests.vectors values (:'validation_vectors'::jsonb);
grant select on tests.vectors to authenticated;

-- 1. The shared vectors: the database agrees with the app ---------------------------------
create function tests.vector_failures(p_set text, p_check text)
returns text[] language plpgsql as $$
declare
  v_value text;
  v_ok boolean;
  v_bad text[] := '{}';
begin
  for v_value in select jsonb_array_elements_text(doc -> p_set -> 'valid') from tests.vectors loop
    execute format('select coalesce(%s, false)', format(p_check, quote_literal(v_value))) into v_ok;
    if not v_ok then v_bad := v_bad || ('valid: ' || v_value); end if;
  end loop;
  for v_value in select jsonb_array_elements_text(doc -> p_set -> 'invalid') from tests.vectors loop
    execute format('select coalesce(%s, false)', format(p_check, quote_literal(v_value))) into v_ok;
    if v_ok then v_bad := v_bad || ('invalid: ' || v_value); end if;
  end loop;
  return v_bad;
end;
$$;

select tests.expect_true('postgres', null, format($$select tests.vector_failures(%L, %L) = '{}'$$, s, c), 'vectors ' || s)
from (values
  ('personName', 'private.is_person_name(%s)'),
  ('businessName', 'private.is_business_name(%s)'),
  ('address', 'private.is_address(%s)'),
  ('phone', 'private.is_co_phone(%s)'),
  ('mobilePhone', 'private.is_co_phone(%s) and %1$s like ''+573%%'''),
  ('instagram', 'private.is_instagram_handle(%s)'),
  ('website', 'private.is_public_website(%s)'),
  ('nit', 'public.is_valid_nit(%s)'),
  ('freeText300', 'private.is_clean_text(%s, 1, 300, true)')
) v(s, c);

select tests.expect_true('postgres', null, $$
  select bool_and(private.co_phone(p ->> 'input') is not distinct from (p ->> 'e164'))
  from tests.vectors, jsonb_array_elements(doc -> 'phoneInput') p$$,
  'phones typed in any usual way are stored as +57 (mobile or landline)');
select tests.expect_true('postgres', null, $$
  select bool_and(private.clean_text(n ->> 'input') = n ->> 'line'
              and private.clean_text(n ->> 'input', true) = n ->> 'lines')
  from tests.vectors, jsonb_array_elements(doc -> 'normalize') n$$,
  'cleaning: invisible characters out, spaces collapsed, NFC (same as TextNormalizer)');
select tests.expect_true('postgres', null, $$
  select bool_and((v::numeric = trunc(v::numeric) and v::numeric between 100 and 10000000) = ok)
  from tests.vectors, lateral (
    select jsonb_array_elements_text(doc -> 'price' -> 'valid'), true
    union all select jsonb_array_elements_text(doc -> 'price' -> 'invalid'), false) p(v, ok)$$,
  'prices: whole pesos between 100 and 10 000 000 (menu_items_price_range)');
select tests.expect_true('postgres', null, $$
  select 'Ñandú' collate "und-x-icu" ~ '^[[:alpha:]]+$'
     and not ('Ñandú' collate "C" ~ '^[[:alpha:]]+$')$$,
  'Unicode letters need the ICU collation: under "C" Postgres only sees ASCII letters');

-- 2. The constraints in action ----------------------------------------------------------
select tests.expect_error('authenticated', tests.id('cus'),
  $$update public.profiles set full_name = 'Ana3' where id = tests.id('cus')$$, 'profiles_full_name_rule');
select tests.exec_as('authenticated', tests.id('cus'),
  $$update public.profiles set full_name = 'María José O''Connor' where id = tests.id('cus')$$);
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set name = 'Café ' || chr(128512) where id = tests.id('pub')$$, 'businesses_name_rule');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set address = 'Calle sin numero' where id = tests.id('pub')$$, 'businesses_address_rule');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set website = 'https://192.168.1.10/menu' where id = tests.id('pub')$$, 'businesses_website_rule');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set phone = '6012345678' where id = tests.id('pub')$$, 'businesses_phone_rule');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.menu_items set price_cop = 50 where id = tests.id('mpub')$$, 'menu_items_price_range');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.menu_items set description = 'Rico' || chr(8203) where id = tests.id('mpub')$$, 'menu_items_description_rule');
select tests.exec_as('authenticated', tests.id('owner'), $$
  insert into public.promotions (business_id, title, starts_at, ends_at, menu_item_id, discount_percent)
  values (tests.id('pub'), 'Tinto al uno', now(), now() + interval '7 days', tests.id('mpub'), 1)$$);
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.promotions (business_id, title, starts_at, ends_at)
  values (tests.id('pub'), 'Todo el año y más', now(), now() + interval '400 days')$$, 'promotions_period_length');
select tests.expect_error('authenticated', tests.id('cus'), $$
  insert into public.reviews (business_id, rating, comment) values (tests.id('pub'), 5, 'Muy  bueno')$$, 'reviews_comment_rule');
select tests.expect_true('postgres', null, $$
  select count(*) = 0 from pg_constraint
  where conname in ('profiles_full_name_rule', 'businesses_name_rule', 'menu_items_price_range', 'orders_notes_rule')
    and convalidated$$,
  'the new rules start NOT VALID: old rows are fixed first (docs/data-quality.sql)');

-- 3. Server-side cleaning ---------------------------------------------------------------------
select tests.exec_as('authenticated', tests.id('cus'), format($$select public.create_order(tests.id('pub'),
  jsonb_build_array(tests.line_of('mpub', 1)), null, %L)$$, '  Sin   cebolla' || chr(8203) || E'\r\n\r\n\r\npor favor '));
select tests.expect_true('postgres', null, $$
  select notes = E'Sin cebolla\n\npor favor' from public.orders where user_id = tests.id('cus')$$,
  'order notes are cleaned on the server (create_order)');
insert into auth.users (id, email, raw_user_meta_data) values
  (tests.id('n1'), 'n1@test.local', '{"account_type": "business_owner", "full_name": "  María   José "}'),
  (tests.id('n2'), 'n2@test.local', '{"account_type": "business_owner", "full_name": "R2D2"}');
select tests.expect_true('postgres', null, $$
  select (select full_name = 'María José' and account_type = 'business_owner' from public.profiles where id = tests.id('n1'))
     and (select full_name is null and account_type = 'business_owner' from public.profiles where id = tests.id('n2'))$$,
  'sign-up: the name is stored cleaned, or dropped when it breaks the rule, never the whole profile');

alter table public.businesses drop constraint businesses_phone_rule;
update public.businesses set phone = '+57 300 111 2233' where id = tests.id('pub');
update public.businesses set phone_verified_at = now() where id = tests.id('pub');
alter table public.businesses add constraint businesses_phone_rule check (phone is null or private.is_co_phone(phone)) not valid;
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.businesses set phone = '+573001112233' where id = tests.id('pub')$$);
select tests.expect_true('postgres', null, $$
  select phone_verified_at is not null from public.businesses where id = tests.id('pub')$$,
  'the same phone saved in the +57 form keeps its verification');
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.businesses set phone = '+573009998877' where id = tests.id('pub')$$);
select tests.expect_true('postgres', null, $$
  select phone_verified_at is null from public.businesses where id = tests.id('pub')$$,
  'another phone is not verified any more');

-- 4. Businesses per owner -------------------------------------------------------------------
insert into auth.users (id, email) values (tests.id('o3'), 'o3@test.local'), (tests.id('o4'), 'o4@test.local'), (tests.id('o5'), 'o5@test.local');
select tests.complete_profile(n) from unnest(array['o3', 'o4', 'o5']) n;
update public.profiles set account_type = 'business_owner' where id in (tests.id('o3'), tests.id('o4'), tests.id('o5'));
create function tests.add_business(p_owner text, p_name text) returns void language sql as $$
  insert into public.businesses (owner_id, name, category, latitude, longitude, address)
  values (tests.id(p_owner), p_name, 'Bar', 1.21, -77.28, 'Calle 1 # 1-1') $$;
grant execute on function tests.add_business(text, text) to authenticated;

select tests.exec_as('authenticated', tests.id('o3'), $$select tests.add_business('o3', n) from unnest(array['Uno', 'Dos', 'Tres']) n$$);
select tests.expect_true('postgres', null, $$
  select exists (select 1 from pg_locks l
    where l.locktype = 'advisory' and l.pid = pg_backend_pid() and l.granted
      and l.objid::bigint = (hashtextextended('businesses:' || tests.id('o3')::text, 0) & 4294967295))$$,
  'each creation takes the per-owner advisory lock (a second simultaneous one waits and counts it)');
select tests.expect_error('authenticated', tests.id('o3'), $$select tests.add_business('o3', 'Cuatro')$$, 'business_limit_reached');
select tests.exec_as('authenticated', tests.id('o4'), $$select tests.add_business('o4', 'Otro dueño')$$);
select tests.expect_true('postgres', null, $$
  select (select count(*) from public.businesses where owner_id = tests.id('o3')) = 3
     and (select count(*) from public.businesses where owner_id = tests.id('o4')) = 1$$,
  'two owners: the limit of one never touches the other');
select tests.exec_as('authenticated', tests.id('o3'), $$delete from public.businesses where owner_id = tests.id('o3') and name = 'Tres'$$);
select tests.expect_error('authenticated', tests.id('o3'), $$select tests.add_business('o3', 'Tres otra vez')$$, 'business_daily_limit');
select tests.expect_true('postgres', null, $$
  select count(*) = 2 from public.businesses where owner_id = tests.id('o3')$$,
  'deleting and creating again does not get around the daily limit');
-- An account above the limit from before keeps its businesses and cannot add more.
insert into public.businesses (owner_id, name, category, latitude, longitude, address)
select tests.id('o5'), 'Antiguo ' || n, 'Bar', 1.21, -77.28, 'Calle 1 # 1-1' from unnest(array['A', 'B', 'C', 'D']) n;
select tests.expect_error('authenticated', tests.id('o5'), $$select tests.add_business('o5', 'Quinto')$$, 'business_limit_reached');
select tests.expect_true('postgres', null, $$
  select count(*) = 4 from public.businesses where owner_id = tests.id('o5')$$,
  'an account already above the limit keeps its four businesses');

-- 5. The panel reads only the owner's rows ------------------------------------------------
select tests.expect_true('authenticated', tests.id('cus'), $$
  select count(*) = 0 from public.businesses where owner_id = auth.uid()$$,
  'a customer opening the panel query (owner_id = me) gets no business');
select tests.expect_true('authenticated', tests.id('eve'), $$
  select (select count(*) from public.businesses where owner_id = auth.uid()) = 0
     and (select count(*) from public.business_orders where business_id = tests.id('pub')) = 0$$,
  'another owner sees neither the businesses nor the orders of someone else in the panel');

-- 6. Review of 52 and 53: contact requests ----------------------------------------------------
select tests.expect_error('authenticated', tests.id('owner'),
  $$select verified_by from public.contact_verifications$$, 'permission denied');
select tests.expect_true('authenticated', tests.id('owner'), $$
  select count(*) >= 0 from (select id, kind, value, code, status, requested_at, verified_at from public.contact_verifications) v$$,
  'the owner still reads every other column of their requests');
update public.businesses set instagram = 'cafe.publico', website = 'https://cafe.example.co' where id = tests.id('pub');
create table tests.req (kind text, code text);
grant all on tests.req to authenticated;
select tests.exec_as('authenticated', tests.id('owner'), $$
  insert into tests.req select k, public.request_contact_verification(tests.id('pub'), k)
  from unnest(array['instagram', 'instagram', 'instagram', 'website']) k$$);
select tests.expect_true('postgres', null, $$
  select (select count(*) from public.contact_verifications where business_id = tests.id('pub') and kind = 'instagram' and status = 'pending') = 1
     and (select count(*) from public.contact_verifications where business_id = tests.id('pub') and kind = 'instagram' and status = 'rejected') = 2
     and (select code from public.contact_verifications where business_id = tests.id('pub') and kind = 'instagram' and status = 'pending')
         = (select code from tests.req where kind = 'instagram' offset 2 limit 1)$$,
  'a new request voids the pending ones of the same kind; the newest code is the one that counts');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.request_contact_verification(tests.id('pub'), 'instagram')$$, 'too_many_requests');
select tests.exec_as('authenticated', tests.id('owner'),
  $$select public.request_contact_verification(tests.id('pub'), 'website')$$);
select tests.expect_true('postgres', null, $$
  select count(*) = 2 from public.contact_verifications where business_id = tests.id('pub') and kind = 'website'$$,
  'the daily limit (3) counts per kind: Instagram used up does not block the website');

rollback;

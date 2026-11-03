-- -----------------------------------------------------------------------------
-- NIT across owners (20261101000000_round4_hardening.sql): a pending business
-- with a NIT already used by a pending business of another owner is only
-- flagged (duplicate_tax_id); review_business refuses an approval with
-- 'tax_id_in_use' when an approved business of ANOTHER owner has that NIT.
-- Roles: owner (v1, o2), another owner (eve, e1), admin (adm) with aal2.
-- Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql
select tests.use_aal('aal2');

insert into public.businesses (id, owner_id, name, category, latitude, longitude, address, phone, is_active) values
  (tests.id('e1'), tests.id('eve'), 'Panadería Eva', 'Panadería', 1.30, -77.30, 'Carrera 5 # 1-2', '+57 311 222 3344', true),
  (tests.id('o2'), tests.id('owner'), 'Segunda Sede', 'Restaurante', 1.31, -77.31, 'Carrera 6 # 1-2', '+57 312 222 3344', true);
insert into public.business_legal (business_id, tax_id, legal_name, legal_rep_name) values
  (tests.id('v1'), '800197268-4', 'Fritanga SAS', 'Ana Pérez'),
  (tests.id('e1'), '800197268-4', 'Otra SAS', 'Eva Ruiz'),
  (tests.id('o2'), '800197268-4', 'Fritanga SAS', 'Ana Pérez');
update public.businesses set verification_status = 'pending' where id in (tests.id('v1'), tests.id('e1'), tests.id('o2'));

create function tests.review(p_business text, p_decision text, p_note text default null) returns void language plpgsql as $$
begin
  perform public.review_business(tests.id(p_business), p_decision, p_note,
    (select updated_at from public.businesses where id = tests.id(p_business)));
end $$;
grant execute on function tests.review(text, text, text) to authenticated;

select tests.expect_true('authenticated', tests.id('adm'),
  $$select duplicate_tax_id from public.business_review_flags(tests.id('v1'))$$,
  'two pending businesses of different owners with one NIT: flagged for the review');
select tests.exec_as('authenticated', tests.id('adm'), $$select tests.review('o2', 'approved')$$);
select tests.expect_error('authenticated', tests.id('adm'), $$select tests.review('e1', 'approved')$$, 'tax_id_in_use');
select tests.expect_true('postgres', null, $$
  select verification_status = 'pending' from public.businesses where id = tests.id('e1')$$,
  'eve cannot get the NIT already approved for another owner; nothing changes');
select tests.exec_as('authenticated', tests.id('adm'), $$select tests.review('v1', 'approved')$$);
select tests.expect_true('postgres', null, $$
  select verification_status = 'approved' from public.businesses where id = tests.id('v1')$$,
  'the same owner may have several approved businesses with one NIT');
select tests.exec_as('authenticated', tests.id('adm'), $$select tests.review('e1', 'rejected', 'NIT de otro negocio')$$);
select tests.expect_true('authenticated', tests.id('adm'), $$
  select array_agg(detail order by created_at, id) = array['approved', 'approved', 'rejected']
  from public.admin_recent_audit(10) where action = 'review_business'$$,
  'rejecting is still possible and only the decisions taken are logged');

rollback;

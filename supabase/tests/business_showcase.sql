-- -----------------------------------------------------------------------------
-- Public contact, gallery and content caps. Roles: owner (pub public, v1
-- draft), another owner (eve), customer, admin, anon. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

create function tests.gallery_path(p_business text, p_file text default 'a')
returns text language sql immutable
as $$ select tests.id(p_business)::text || '/gallery/' || tests.id('photo-' || p_file)::text || '.webp' $$;
grant execute on function tests.gallery_path(text, text) to anon, authenticated;

-- -- contact ---------------------------------------------------------------------------
select tests.exec_as('authenticated', tests.id('owner'), $$
  update public.businesses set whatsapp = '+573001234567', instagram = 'cafe.publico',
    facebook = 'CafePublico', website = 'https://cafepublico.co' where id = tests.id('pub')$$);
select tests.expect_true('anon', null,
  $$select whatsapp = '+573001234567' and instagram = 'cafe.publico' and website = 'https://cafepublico.co'
    from public.businesses where id = tests.id('pub')$$, 'contact of a public business is public');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set whatsapp = '3001234567' where id = tests.id('pub')$$, 'businesses_whatsapp_co_mobile');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set instagram = '@Cafe Publico' where id = tests.id('pub')$$, 'businesses_instagram_handle');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set website = 'http://cafepublico.co' where id = tests.id('pub')$$, 'businesses_website_https');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set website = 'javascript:alert(1)' where id = tests.id('pub')$$, 'businesses_website_https');
select tests.expect_true('authenticated', tests.id('eve'), $$
  with changed as (update public.businesses set instagram = 'robado' where id = tests.id('pub') returning 1)
  select count(*) = 0 from changed$$, 'another owner cannot change it');

-- -- gallery ---------------------------------------------------------------------------
select tests.exec_as('authenticated', tests.id('owner'), $$
  insert into public.business_photos (business_id, storage_path, caption) values
    (tests.id('pub'), tests.gallery_path('pub'), 'Terraza'),
    (tests.id('v1'), tests.gallery_path('v1'), null)$$);
select tests.expect_true('anon', null,
  $$select count(*) = 1 and bool_and(caption = 'Terraza') from public.business_photos$$,
  'anon sees photos of public businesses only');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 2 from public.business_photos$$, 'the owner sees the photos of their draft business too');
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.business_photos (business_id, storage_path) values (tests.id('pub'), tests.gallery_path('v1', 'b'))$$,
  'business_photos_path_shape');
select tests.expect_error('authenticated', tests.id('eve'), $$
  insert into public.business_photos (business_id, storage_path) values (tests.id('pub'), tests.gallery_path('pub', 'c'))$$,
  'row-level security');
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.business_photos (business_id, storage_path, caption)
  values (tests.id('pub'), tests.gallery_path('pub', 'd'), repeat('x', 61))$$, 'business_photos_caption_length');
select tests.expect_error('authenticated', tests.id('cus'), $$
  insert into public.business_photos (business_id, storage_path) values (tests.id('pub'), tests.gallery_path('pub', 'e'))$$,
  'row-level security');
select tests.exec_as('authenticated', tests.id('owner'), $$
  insert into public.business_photos (business_id, storage_path)
  select tests.id('pub'), tests.gallery_path('pub', 'n' || n) from generate_series(1, 7) n$$);
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.business_photos (business_id, storage_path) values (tests.id('pub'), tests.gallery_path('pub', 'ninth'))$$,
  'gallery_limit');
select tests.expect_true('authenticated', tests.id('eve'), $$
  with gone as (delete from public.business_photos where business_id = tests.id('pub') returning 1)
  select count(*) = 0 from gone$$, 'another owner cannot delete them');

-- -- Storage: gallery folder and 80 files per business ----------------------------------
select tests.exec_as('authenticated', tests.id('owner'),
  $$insert into storage.objects (bucket_id, name) values ('business-images', tests.gallery_path('pub', 'file'))$$);
insert into storage.objects (bucket_id, name)
select 'business-images', tests.id('pub')::text || '/menu/' || tests.id('m' || n)::text || '.webp' from generate_series(1, 79) n;
select tests.expect_error('authenticated', tests.id('owner'),
  $$insert into storage.objects (bucket_id, name) values ('business-images', tests.gallery_path('pub', 'too-many'))$$,
  'row-level security');

-- -- menu: at most 200 items ---------------------------------------------------------------
insert into public.menu_items (business_id, name, price_cop)
select tests.id('pub'), 'Item ' || n, 1000 from generate_series(1, 199) n;
select tests.expect_error('authenticated', tests.id('owner'),
  $$insert into public.menu_items (business_id, name, price_cop) values (tests.id('pub'), 'Uno más', 1000)$$, 'menu_limit');

rollback;

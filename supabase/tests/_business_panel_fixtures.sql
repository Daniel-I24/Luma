-- Fixtures for the business panel tests (loaded with \ir, inside the test transaction).
-- owner has no business yet; eve owns a published one.
insert into auth.users (id, email) values
  (tests.id('owner'), 'owner@test.local'),
  (tests.id('eve'),   'eve@test.local');

-- Eve owns a published business with hours, a menu and an expired promotion.
insert into public.businesses (id, owner_id, name, category, latitude, longitude, address, is_active) values
  (tests.id('eve-biz'), tests.id('eve'), 'Eve Bar', 'Bar', 1.21, -77.28, 'Calle 5 # 1-1', true);
insert into public.business_hours (business_id, day_of_week, opens_at, closes_at) values
  (tests.id('eve-biz'), 1, '18:00', '02:00');
insert into public.promotions (business_id, title, starts_at, ends_at) values
  (tests.id('eve-biz'), 'Old promo', now() - interval '9 days', now() - interval '2 days');

-- Both are business-owner accounts (only those may create businesses).
update public.profiles set account_type = 'business_owner'
where id in (tests.id('owner'), tests.id('eve'));

-- Data shaped like production BEFORE the pending migrations: only the four
-- applied migrations exist. Some rows are deliberately dirty (http logo,
-- unknown category, short name, promotion with end before start) to prove
-- that the NOT VALID constraints let the migrations run and the report finds
-- them.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000a1', 'ana@legacy.test', now()),
  ('00000000-0000-4000-8000-0000000000a2', 'beto@legacy.test', null);

insert into public.businesses (id, owner_id, name, category, logo_url, latitude, longitude, address, phone) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1',
   'Panaderia La Esquina', 'Panadería', 'https://cdn.example.com/logo.webp', 1.2136, -77.2811, 'Calle 18 # 25-30', '+57 300 111 2233'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1',
   'X', 'Bar', 'http://insecure.example.com/logo.png', 1.21, -77.28, 'Cra 1', null);

insert into public.business_hours (business_id, day_of_week, opens_at, closes_at)
select '00000000-0000-4000-8000-0000000000b1', d, '07:00', '19:00' from generate_series(0, 6) d;

insert into public.promotions (business_id, title, starts_at, ends_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'Pan del dia', now() - interval '1 day', now() + interval '6 days'),
  ('00000000-0000-4000-8000-0000000000b2', 'Mal', now(), now() - interval '1 day');

insert into public.menu_items (business_id, name, price_cop, section) values
  ('00000000-0000-4000-8000-0000000000b1', 'Pan de bono', 1500, 'Panes');
insert into public.favorites (user_id, business_id) values
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000b1');
insert into public.reviews (business_id, user_id, rating, comment) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a2', 5, 'Muy bueno');

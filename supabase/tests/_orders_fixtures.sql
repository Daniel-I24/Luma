-- Fixtures for the order tests (loaded with \ir, inside the test transaction).
-- owner owns b1, b2 and the inactive b3; ana and bob are customers.

insert into auth.users (id, email) values
  (tests.id('owner'), 'owner@test.local'),
  (tests.id('ana'),   'ana@test.local'),
  (tests.id('bob'),   'bob@test.local');

insert into public.businesses (id, owner_id, name, category, latitude, longitude, address, is_active) values
  (tests.id('b1'), tests.id('owner'), 'Test Fritanga', 'Restaurante', 1.21, -77.28, 'Calle 1', true),
  (tests.id('b2'), tests.id('owner'), 'Test Café',     'Cafetería',   1.21, -77.28, 'Calle 2', true),
  (tests.id('b3'), tests.id('owner'), 'Test Cerrado',  'Tienda',      1.21, -77.28, 'Calle 3', false);

-- Test businesses are verified (b3 is unpublished).
update public.businesses set verification_status = 'approved'
where id in (tests.id('b1'), tests.id('b2'), tests.id('b3'));

-- b1 and b2 are open all day, every day (create_order checks opening hours).
insert into public.business_hours (business_id, day_of_week, opens_at, closes_at)
select b, d, '00:00', '23:59:59.999999'
from unnest(array[tests.id('b1'), tests.id('b2')]) b, generate_series(0, 6) d;

insert into public.menu_items (id, business_id, name, price_cop, is_available) values
  (tests.id('m1'), tests.id('b1'), 'Fritanga mixta', 6000, true),
  (tests.id('m2'), tests.id('b1'), 'Agotado',        4000, false),
  (tests.id('m4'), tests.id('b1'), 'Jugo de lulo',   2000, true),
  (tests.id('m3'), tests.id('b2'), 'Capuchino',      5000, true),
  (tests.id('m5'), tests.id('b3'), 'Pan',            1000, true);

-- One order line as the client would send it ({menu_item_id, quantity}).
create function tests.line(p_item text, p_quantity jsonb, p_extra jsonb default '{}')
returns jsonb
language sql
immutable
as $$ select jsonb_build_object('menu_item_id', tests.id(p_item), 'quantity', p_quantity) || p_extra $$;
grant execute on function tests.line(text, jsonb, jsonb) to anon, authenticated;

-- Id of an order by its (unique per test) notes.
create function tests.order_id(p_notes text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select o.id from public.orders o where o.notes = p_notes $$;
grant execute on function tests.order_id(text) to anon, authenticated;

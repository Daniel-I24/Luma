-- Fixtures for the verification tests (loaded with \ir inside the transaction).
-- owner owns v1 (draft, published flag on, complete except legal data and
-- documents) and pub (approved and public); cus is a customer; adm an admin.
insert into auth.users (id, email) values
  (tests.id('owner'), 'owner@test.local'),
  (tests.id('eve'),   'eve@test.local'),
  (tests.id('cus'),   'cus@test.local'),
  (tests.id('adm'),   'adm@test.local');
update public.profiles set account_type = 'business_owner' where id in (tests.id('owner'), tests.id('eve'));
insert into public.admins (user_id) values (tests.id('adm'));

insert into public.businesses (id, owner_id, name, category, latitude, longitude, address, phone, is_active) values
  (tests.id('v1'),  tests.id('owner'), 'Fritanga Nueva', 'Restaurante', 1.21, -77.28, 'Calle 18 # 25-30', '+57 300 111 2233', true),
  (tests.id('pub'), tests.id('owner'), 'Café Público',   'Cafetería',   1.21, -77.28, 'Calle 19 # 20-10', null, true);
update public.businesses set verification_status = 'approved' where id = tests.id('pub');
insert into public.business_hours (business_id, day_of_week, opens_at, closes_at)
select b, d, '00:00', '23:59:59.999999'
from unnest(array[tests.id('v1'), tests.id('pub')]) b, generate_series(0, 6) d;
insert into public.menu_items (id, business_id, name, price_cop) values
  (tests.id('mv1'), tests.id('v1'), 'Fritanga', 18000),
  (tests.id('mpub'), tests.id('pub'), 'Tinto', 2000);

-- Path of a verification document of v1.
create function tests.doc_path(p_kind text, p_ext text default 'pdf')
returns text language sql immutable
as $$ select tests.id('v1')::text || '/' || p_kind || '/' || tests.id('doc-' || p_kind)::text || '.' || p_ext $$;
grant execute on function tests.doc_path(text, text) to anon, authenticated;

-- One order line ({menu_item_id, quantity}).
create function tests.line_of(p_item text, p_quantity int)
returns jsonb language sql immutable
as $$ select jsonb_build_object('menu_item_id', tests.id(p_item), 'quantity', p_quantity) $$;
grant execute on function tests.line_of(text, int) to anon, authenticated;

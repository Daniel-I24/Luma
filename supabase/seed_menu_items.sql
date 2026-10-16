-- ─────────────────────────────────────────────────────────────────────────────
-- Test menu for the 5 seeded businesses in Pasto.
--
-- Repeatable: deletes only the menu_items of these 5 businesses and inserts
-- them again, linking each row to its business by NAME (no ids, no owner).
-- Run it after seed.sql (or against any database where those businesses exist):
--   psql "$DATABASE_URL" -f supabase/seed_menu_items.sql
-- Prices in whole Colombian pesos (COP).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

delete from public.menu_items
where business_id in (
  select id from public.businesses
  where name in (
    'Fritanga Don Segundo',
    'Café La Merced',
    'Panadería El Volcán',
    'Heladería Galeras',
    'Minimarket San Juan'
  )
);

insert into public.menu_items
  (business_id, section, name, description, price_cop, sort_order)
select b.id, m.section, m.name, m.description, m.price_cop, m.sort_order
from (
  values
    ('Fritanga Don Segundo', 'Entradas', 'Empanadas de añejo (3 und.)', 'Con ají de maní.', 6000, 1),
    ('Fritanga Don Segundo', 'Platos fuertes', 'Fritanga mixta', 'Chicharrón, carne, papa amarilla, mote y ají.', 28000, 2),
    ('Fritanga Don Segundo', 'Platos fuertes', 'Cuy asado (medio)', 'Con papa, ají de maní y ensalada.', 45000, 3),
    ('Fritanga Don Segundo', 'Bebidas', 'Jugo de lulo en agua', 'Vaso de 16 oz.', 5000, 4),

    ('Café La Merced', 'Bebidas calientes', 'Café americano', 'Café de origen nariñense, 8 oz.', 4000, 1),
    ('Café La Merced', 'Bebidas calientes', 'Capuchino', 'Doble espresso con leche espumada, 12 oz.', 6500, 2),
    ('Café La Merced', 'Repostería', 'Croissant de almendras', 'Horneado cada mañana.', 7000, 3),
    ('Café La Merced', 'Desayunos', 'Desayuno nariñense', 'Huevos al gusto, arepa, queso, chocolate y fruta.', 16000, 4),

    ('Panadería El Volcán', 'Panes', 'Pan de cuajada', 'La especialidad de la casa.', 1500, 1),
    ('Panadería El Volcán', 'Panes', 'Mojicón', 'Pan dulce con azúcar.', 1200, 2),
    ('Panadería El Volcán', 'Panes', 'Pan integral (500 g)', 'Con semillas de girasol y linaza.', 6000, 3),
    ('Panadería El Volcán', 'Tortas', 'Torta de naranja (porción)', null, 4500, 4),

    ('Heladería Galeras', 'Helados', 'Helado de lulo (sencillo)', 'Una bola en cono.', 5000, 1),
    ('Heladería Galeras', 'Helados', 'Helado de paila', 'Preparado artesanalmente en paila de cobre.', 7000, 2),
    ('Heladería Galeras', 'Copas', 'Copa Galeras', 'Tres sabores, frutas, crema y salsa de mora.', 14000, 3),
    ('Heladería Galeras', 'Bebidas', 'Malteada de mora', '16 oz.', 11000, 4),

    ('Minimarket San Juan', 'Bebidas', 'Agua sin gas (600 ml)', null, 2500, 1),
    ('Minimarket San Juan', 'Bebidas', 'Gaseosa (1,5 L)', null, 5500, 2),
    ('Minimarket San Juan', 'Despensa', 'Pan tajado (600 g)', null, 6800, 3),
    ('Minimarket San Juan', 'Despensa', 'Leche entera (1 L)', null, 4600, 4)
) as m (business_name, section, name, description, price_cop, sort_order)
join public.businesses b on b.name = m.business_name;

commit;

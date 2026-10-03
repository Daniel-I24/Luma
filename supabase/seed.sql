-- ─────────────────────────────────────────────────────────────────────────────
-- Seed data: 5 fictional businesses in Pasto, Nariño, Colombia.
-- Real coordinates from the city centre area.
-- Includes varied categories, schedules, and promotions to exercise all
-- four BusinessStatus values: open, closed, opening-soon, closing-soon.
--
-- NOTE: Requires a dummy owner in auth.users first.
--       In local Supabase dev, create a user via the dashboard or CLI
--       and replace the owner_id UUIDs below.
-- ─────────────────────────────────────────────────────────────────────────────

-- Placeholder owner (replace with a real auth.users id in your dev environment)
do $$
declare
  owner uuid := '00000000-0000-0000-0000-000000000001';

  b1 uuid := gen_random_uuid();
  b2 uuid := gen_random_uuid();
  b3 uuid := gen_random_uuid();
  b4 uuid := gen_random_uuid();
  b5 uuid := gen_random_uuid();
begin

  -- ── Businesses ─────────────────────────────────────────────────────────────

  insert into public.businesses
    (id, owner_id, name, description, category, latitude, longitude, address, phone, is_active)
  values
    -- 1. Restaurante near Plaza de Nariño — open all day
    (b1, owner, 'Fritanga Don Segundo',
     'Fritanga y bandeja típica nariñense en el centro de Pasto.',
     'Restaurante', 1.2136, -77.2811,
     'Calle 19 # 22-40, Pasto, Nariño', '+573001112233', true),

    -- 2. Café near Parque Infantil — opens late morning
    (b2, owner, 'Café La Merced',
     'Café de origen nariñense, repostería artesanal y desayunos.',
     'Cafetería', 1.2150, -77.2795,
     'Carrera 24 # 18-12, Pasto, Nariño', '+573104445566', true),

    -- 3. Panadería near Universidad de Nariño — closes early
    (b3, owner, 'Panadería El Volcán',
     'Pan artesanal horneado cada mañana. Especialidad: pan de cuajada.',
     'Panadería', 1.2094, -77.2862,
     'Calle 18 # 29-55, Pasto, Nariño', '+573207778899', true),

    -- 4. Heladería — opens noon, closes late
    (b4, owner, 'Heladería Galeras',
     'Helados artesanales de frutas exóticas del Pacífico y la Amazonía.',
     'Heladería', 1.2168, -77.2830,
     'Carrera 25 # 17-08, Pasto, Nariño', '+573158889900', true),

    -- 5. Tienda de abarrotes — 24 h (overnight crossover schedule)
    (b5, owner, 'Minimarket San Juan',
     'Tienda de barrio con todo lo que necesitas, abierta casi todo el día.',
     'Tienda', 1.2121, -77.2850,
     'Calle 20 # 27-33, Pasto, Nariño', '+573012223344', true);

  -- ── business_hours ──────────────────────────────────────────────────────────
  -- Day encoding: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat

  -- B1 Fritanga Don Segundo: Mon–Sat 10:00–22:00, Sun closed
  insert into public.business_hours (business_id, day_of_week, opens_at, closes_at, is_closed)
  values
    (b1, 0, '10:00', '22:00', true),   -- Sunday: closed
    (b1, 1, '10:00', '22:00', false),
    (b1, 2, '10:00', '22:00', false),
    (b1, 3, '10:00', '22:00', false),
    (b1, 4, '10:00', '22:00', false),
    (b1, 5, '10:00', '22:00', false),
    (b1, 6, '10:00', '22:00', false);

  -- B2 Café La Merced: Tue–Sun 08:30–19:00, Mon closed
  insert into public.business_hours (business_id, day_of_week, opens_at, closes_at, is_closed)
  values
    (b2, 0, '08:30', '19:00', false),
    (b2, 1, '08:30', '19:00', true),   -- Monday: closed
    (b2, 2, '08:30', '19:00', false),
    (b2, 3, '08:30', '19:00', false),
    (b2, 4, '08:30', '19:00', false),
    (b2, 5, '08:30', '19:00', false),
    (b2, 6, '08:30', '19:00', false);

  -- B3 Panadería El Volcán: every day 05:30–14:00 (closes early afternoon)
  insert into public.business_hours (business_id, day_of_week, opens_at, closes_at, is_closed)
  values
    (b3, 0, '05:30', '14:00', false),
    (b3, 1, '05:30', '14:00', false),
    (b3, 2, '05:30', '14:00', false),
    (b3, 3, '05:30', '14:00', false),
    (b3, 4, '05:30', '14:00', false),
    (b3, 5, '05:30', '14:00', false),
    (b3, 6, '05:30', '14:00', false);

  -- B4 Heladería Galeras: every day 12:00–23:30 (closes near midnight)
  insert into public.business_hours (business_id, day_of_week, opens_at, closes_at, is_closed)
  values
    (b4, 0, '12:00', '23:30', false),
    (b4, 1, '12:00', '23:30', false),
    (b4, 2, '12:00', '23:30', false),
    (b4, 3, '12:00', '23:30', false),
    (b4, 4, '12:00', '23:30', false),
    (b4, 5, '12:00', '23:30', false),
    (b4, 6, '12:00', '23:30', false);

  -- B5 Minimarket San Juan: every day 06:00–02:00 (crosses midnight)
  insert into public.business_hours (business_id, day_of_week, opens_at, closes_at, is_closed)
  values
    (b5, 0, '06:00', '02:00', false),
    (b5, 1, '06:00', '02:00', false),
    (b5, 2, '06:00', '02:00', false),
    (b5, 3, '06:00', '02:00', false),
    (b5, 4, '06:00', '02:00', false),
    (b5, 5, '06:00', '02:00', false),
    (b5, 6, '06:00', '02:00', false);

  -- ── promotions ──────────────────────────────────────────────────────────────
  insert into public.promotions
    (business_id, title, description, starts_at, ends_at, is_active)
  values
    (b1, 'Bandeja especial de lunes', 'Bandeja paisa completa a $15.000 los lunes.',
     now() - interval '1 day', now() + interval '7 days', true),

    (b2, 'Café + croissant madrugador', 'Pide antes de las 9 AM y lleva café + croissant por $8.000.',
     now() - interval '2 days', now() + interval '14 days', true),

    (b4, 'Dos por uno viernes', 'Compra un helado doble el viernes y lleva otro gratis.',
     now(), now() + interval '5 days', true);

end $$;

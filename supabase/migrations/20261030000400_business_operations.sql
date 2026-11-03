-- -----------------------------------------------------------------------------
-- Migration: business_operations
--   1. businesses.orders_paused_until: create_order refuses new orders
--      ('business_paused') until then; 'infinity' means until the owner
--      resumes. Public (customers see "Pedidos en pausa"); written only by
--      set_orders_paused.
--   2. set_orders_paused(business, minutes): the owner pauses for 15, 30, 60
--      or 120 minutes, -1 until resumed, 0 resumes.
--   3. businesses.department and city_dane_code, chosen by the owner in the
--      registration wizard (DANE municipality code, five digits).
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

alter table public.businesses
  add column if not exists orders_paused_until timestamptz,
  add column if not exists department text
    constraint businesses_department_length check (department is null or char_length(btrim(department)) between 2 and 60),
  add column if not exists city_dane_code text
    constraint businesses_city_dane_code_shape check (city_dane_code is null or city_dane_code ~ '^[0-9]{5}$');

comment on column public.businesses.orders_paused_until is 'No new orders until then (infinity: until resumed).';
grant insert (department, city_dane_code), update (department, city_dane_code) on public.businesses to authenticated;

create or replace function public.set_orders_paused(p_business_id uuid, p_minutes integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_until timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  if not public.owns_business(p_business_id) then
    raise exception using errcode = '42501', message = 'not_business_owner';
  end if;
  if p_minutes is null or p_minutes not in (-1, 0, 15, 30, 60, 120) then
    raise exception using errcode = 'P0001', message = 'invalid_pause';
  end if;
  v_until := case p_minutes when 0 then null when -1 then 'infinity'::timestamptz
                            else now() + make_interval(mins => p_minutes) end;
  update public.businesses set orders_paused_until = v_until where id = p_business_id;
  return v_until;
end;
$$;

revoke execute on function public.set_orders_paused(uuid, integer) from public, anon;
grant execute on function public.set_orders_paused(uuid, integer) to authenticated;

-- True while the business takes no new orders.
create or replace function public.business_paused(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select b.orders_paused_until > now() from public.businesses b where b.id = p_business_id), false)
$$;

revoke execute on function public.business_paused(uuid) from public, anon;
grant execute on function public.business_paused(uuid) to authenticated;

notify pgrst, 'reload schema';

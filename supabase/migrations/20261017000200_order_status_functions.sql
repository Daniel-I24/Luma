-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: order_status_functions
-- Status changes of an order. NOT APPLIED YET.
-- SECURITY DEFINER with an empty search_path; executable only by authenticated.
-- ─────────────────────────────────────────────────────────────────────────────

-- The customer cancels their own order while it is still pending.
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select o.status into v_status
  from public.orders o
  where o.id = p_order_id and o.user_id = auth.uid()
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'order_not_found';
  end if;
  if v_status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'invalid_transition';
  end if;
  update public.orders set status = 'cancelled' where id = p_order_id;
end;
$$;

-- The business owner moves an order forward:
-- pending → accepted | cancelled, accepted → preparing, preparing → ready,
-- ready → picked_up. No screen uses it yet.
create or replace function public.set_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select o.status into v_status
  from public.orders o
  join public.businesses b on b.id = o.business_id
  where o.id = p_order_id and b.owner_id = auth.uid()
  for update of o;
  if not found then
    raise exception using errcode = 'P0001', message = 'order_not_found';
  end if;
  if (v_status, p_status) not in (
    ('pending', 'accepted'), ('pending', 'cancelled'), ('accepted', 'preparing'),
    ('preparing', 'ready'), ('ready', 'picked_up')
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_transition';
  end if;
  update public.orders set status = p_status where id = p_order_id;
end;
$$;

revoke execute on function public.cancel_order(uuid) from public, anon;
revoke execute on function public.set_order_status(uuid, text) from public, anon;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.set_order_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';

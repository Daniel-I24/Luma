-- -----------------------------------------------------------------------------
-- Migration: trust_status
--   1. my_trust_status(): the caller's tier, active strikes, when the
--      restriction ends, picked-up orders and how many are left to become
--      trusted (for the "Tu estado" screen).
--   2. admin_strikes(): customers with active no-show strikes (user id,
--      strikes, last strike, tier). Admin with aal2; no personal data.
--   3. admin_clear_strikes(user): forgets the strikes so far (logged).
-- Depends on 20261030000200_trust_tiers.sql.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

create or replace function public.my_trust_status()
returns table (tier text, strikes integer, restricted_until timestamptz,
               picked_up integer, picked_up_needed integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  return query
  select public.customer_trust_tier(v_user), s.strikes, s.restricted_until, p.done,
         greatest(coalesce((select v.int_value from public.app_settings v
                            where v.key = 'trust_trusted_min_picked_up'), 2) - p.done, 0)
  from public.customer_strikes(v_user) s,
       (select count(*)::integer as done from public.orders o
        where o.user_id = v_user and o.status = 'picked_up') p;
end;
$$;

revoke execute on function public.my_trust_status() from public, anon;
grant execute on function public.my_trust_status() to authenticated;

create or replace function public.admin_strikes()
returns table (user_id uuid, strikes integer, last_strike_at timestamptz, tier text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  return query
  select u.id, s.strikes,
         (select max(o.cancelled_at) from public.orders o where o.user_id = u.id and o.cancel_reason = 'no_show'),
         public.customer_trust_tier(u.id)
  from (select distinct o.user_id as id from public.orders o
        where o.cancel_reason = 'no_show' and o.user_id is not null) u,
       public.customer_strikes(u.id) s
  where s.strikes > 0
  order by s.strikes desc, 3 desc
  limit 200;
end;
$$;

revoke execute on function public.admin_strikes() from public, anon;
grant execute on function public.admin_strikes() to authenticated;

create or replace function public.admin_clear_strikes(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  update public.profiles set strikes_cleared_at = now() where id = p_user_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'user_not_found';
  end if;
  perform public.log_admin_action('clear_strikes', 'user', p_user_id);
end;
$$;

revoke execute on function public.admin_clear_strikes(uuid) from public, anon;
grant execute on function public.admin_clear_strikes(uuid) to authenticated;

notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Migration: readable_export (pending review).
-- export_my_data (right of access, Ley 1581 de 2012) answers what a person can
-- read: business names instead of ids, no internal ids or storage paths. Opening
-- "Mis datos" now reads it, so the limit goes from 3 to 10 a day. Same signature
-- and grants as 20261028000000_export_my_data.sql. Still only the caller's data.
-- -----------------------------------------------------------------------------

create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_day  date := (now() at time zone 'America/Bogota')::date;
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  if coalesce((select calls from public.ai_usage where day = v_day and scope = 'export' and subject = v_user), 0) >= 10 then
    raise exception using errcode = 'P0001', message = 'export_limit';
  end if;
  insert into public.ai_usage (day, scope, subject, calls) values (v_day, 'export', v_user, 1)
  on conflict (day, scope, subject) do update set calls = public.ai_usage.calls + 1;

  return jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at, 'email_confirmed_at', u.email_confirmed_at)
                from auth.users u where u.id = v_user),
    'profile', (select to_jsonb(p) - 'id' - 'avatar_path' - 'residence_dane_code' from public.profiles p where p.id = v_user),
    'favorites', coalesce((select jsonb_agg(jsonb_build_object('business', b.name, 'created_at', f.created_at) order by f.created_at desc)
                           from public.favorites f join public.businesses b on b.id = f.business_id
                           where f.user_id = v_user), '[]'),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('business', b.name, 'rating', r.rating, 'comment', r.comment,
                                                             'created_at', r.created_at) order by r.created_at desc)
                         from public.reviews r join public.businesses b on b.id = r.business_id
                         where r.user_id = v_user), '[]'),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('business', b.name, 'reason', r.reason, 'comment', r.comment,
                                                             'status', r.status))
                         from public.reports r join public.businesses b on b.id = r.business_id
                         where r.reporter = v_user), '[]'),
    'orders', coalesce((select jsonb_agg(jsonb_build_object(
                          'business', o.business_name, 'status', o.status, 'payment_method', o.payment_method,
                          'payment_status', o.payment_status, 'total_cop', o.total_cop, 'notes', o.notes,
                          'pickup_at', o.pickup_at, 'created_at', o.created_at,
                          'items', (select coalesce(jsonb_agg(jsonb_build_object(
                                      'name', i.name, 'quantity', i.quantity, 'unit_price_cop', i.unit_price_cop)), '[]')
                                    from public.order_items i where i.order_id = o.id))
                          order by o.created_at desc)
                        from public.orders o where o.user_id = v_user), '[]'),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object(
                                 'type', n.type, 'status', n.status, 'business', b.name,
                                 'created_at', n.created_at, 'read_at', n.read_at) order by n.created_at desc)
                               from public.notifications n left join public.businesses b on b.id = n.business_id
                               where n.user_id = v_user), '[]'),
    'devices', (select count(*) from public.device_tokens d where d.user_id = v_user),
    'businesses', coalesce((select jsonb_agg(jsonb_build_object(
                              'name', b.name, 'category', b.category, 'address', b.address, 'phone', b.phone,
                              'verification_status', b.verification_status,
                              'legal', (select jsonb_build_object('tax_id', l.tax_id, 'legal_name', l.legal_name,
                                                                  'legal_rep_name', l.legal_rep_name)
                                        from public.business_legal l where l.business_id = b.id),
                              'menu_items', (select count(*) from public.menu_items m where m.business_id = b.id)))
                            from public.businesses b where b.owner_id = v_user), '[]')
  );
end;
$$;

revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

notify pgrst, 'reload schema';

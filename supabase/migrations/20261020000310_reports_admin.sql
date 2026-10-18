-- -----------------------------------------------------------------------------
-- Migration: reports_admin
-- Admins list open reports (never the reporter) and resolve them.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

create or replace function public.admin_open_reports()
returns table (id uuid, business_id uuid, business_name text, reason text, comment text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  -- Never the reporter: admins act on the business, not on who reported it.
  return query
    select r.id, r.business_id, b.name, r.reason, r.comment, r.created_at
    from public.reports r join public.businesses b on b.id = r.business_id
    where r.status = 'open' order by r.created_at;
end;
$$;

create or replace function public.resolve_report(p_report_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  if p_status not in ('reviewed', 'dismissed') then
    raise exception using errcode = 'P0001', message = 'invalid_status';
  end if;
  update public.reports set status = p_status where id = p_report_id and status = 'open';
end;
$$;

revoke execute on function public.admin_open_reports() from public, anon;
revoke execute on function public.resolve_report(uuid, text) from public, anon;
grant execute on function public.admin_open_reports() to authenticated;
grant execute on function public.resolve_report(uuid, text) to authenticated;

notify pgrst, 'reload schema';

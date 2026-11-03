-- -----------------------------------------------------------------------------
-- Migration: admin_mfa_audit
--   1. is_admin() also needs aal2 in the JWT (a TOTP factor verified in this
--      session). Every admin policy and RPC already calls is_admin(), so all
--      of them need MFA from here on. Same signature and grants.
--   2. admin_access(): 'none', 'needs_mfa' or 'ok' for the caller only, so
--      the app can ask an admin for the TOTP code without learning anything
--      about other users.
--   3. admin_audit_log: insert only. No client grants; a trigger refuses
--      UPDATE and DELETE for every role, service_role and postgres included.
--      Rows: who, action, target, when. Never personal data.
--   4. log_admin_action(action, target_type, target_id): internal, used by
--      admin RPCs. admin_recent_audit(limit): admins with aal2 read it.
--   5. review_business: same signature and behaviour, now also logged.
-- Depends on 20261020000000 and 20261020000300.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

-- 1. MFA for admins ------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
     and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 2. What the app shows ------------------------------------------------------------
create or replace function public.admin_access()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (select 1 from public.admins a where a.user_id = (select auth.uid())) then 'none'
    when public.is_admin() then 'ok'
    else 'needs_mfa'
  end
$$;

revoke execute on function public.admin_access() from public, anon;
grant execute on function public.admin_access() to authenticated;

-- 3. Audit log -------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id          bigint generated always as identity,
  actor_id    uuid        not null,
  action      text        not null constraint admin_audit_log_action_valid
    check (action in ('review_business', 'void_payment', 'mark_refund_done', 'clear_strikes', 'reconcile_payments')),
  target_type text        not null constraint admin_audit_log_target_valid
    check (target_type in ('business', 'payment', 'user', 'system')),
  target_id   uuid,
  detail      text        constraint admin_audit_log_detail_shape check (detail is null or detail ~ '^[a-z_]{1,40}$'),
  created_at  timestamptz not null default now(),
  constraint admin_audit_log_pkey primary key (id)
);

comment on table public.admin_audit_log is 'Append-only log of admin actions (who, action, target, when).';
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public, anon, authenticated, service_role;

create or replace function public.admin_audit_log_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'audit_log_append_only';
end;
$$;

revoke execute on function public.admin_audit_log_append_only() from public, anon, authenticated;

drop trigger if exists admin_audit_log_append_only on public.admin_audit_log;
create trigger admin_audit_log_append_only
  before update or delete on public.admin_audit_log
  for each row execute function public.admin_audit_log_append_only();
drop trigger if exists admin_audit_log_no_truncate on public.admin_audit_log;
create trigger admin_audit_log_no_truncate
  before truncate on public.admin_audit_log
  for each statement execute function public.admin_audit_log_append_only();

-- 4. Writing and reading the log ----------------------------------------------------------
create or replace function public.log_admin_action(p_action text, p_target_type text, p_target_id uuid,
                                                   p_detail text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, detail)
  values (coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'), p_action, p_target_type, p_target_id, p_detail)
$$;

-- Internal: only other SECURITY DEFINER functions call it.
revoke execute on function public.log_admin_action(text, text, uuid, text) from public, anon, authenticated;

create or replace function public.admin_recent_audit(p_limit integer default 50)
returns table (id bigint, actor_id uuid, action text, target_type text, target_id uuid,
               detail text, created_at timestamptz)
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
  select l.id, l.actor_id, l.action, l.target_type, l.target_id, l.detail, l.created_at
  from public.admin_audit_log l
  order by l.created_at desc, l.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

revoke execute on function public.admin_recent_audit(integer) from public, anon;
grant execute on function public.admin_recent_audit(integer) to authenticated;

notify pgrst, 'reload schema';

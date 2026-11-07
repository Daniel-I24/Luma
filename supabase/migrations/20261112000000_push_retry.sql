-- -----------------------------------------------------------------------------
-- Migration: push_retry (pending review).
-- A notice whose send failed for a passing reason (FCM down, quota, network) was
-- lost: each one is claimed once. Now only the failed phones are tried again.
--   1. private.push_retries: notification + token, which attempt, when it is due.
--   2. schedule_push_retry(): up to 3 more tries, after 1, 5 and 15 minutes.
--   3. claim_push_retries(): what is due, within push_claim_window_minutes, with
--      consent and the token checked again. Same shape as claim_push_batch.
--   4. private.push_work_pending() also wakes up for a retry that is due.
-- A phone that already got the notice is never in the table, so it gets no second one.
-- -----------------------------------------------------------------------------

create table private.push_retries (
  notification_id uuid        not null references public.notifications (id) on delete cascade,
  token           text        not null,
  attempt         integer     not null constraint push_retries_attempt check (attempt between 1 and 3),
  retry_at        timestamptz not null,
  constraint push_retries_pkey primary key (notification_id, token)
);
create index push_retries_due on private.push_retries (retry_at);
revoke all on private.push_retries from public, anon, authenticated;

-- How many tries were scheduled: 0 once the attempts are used up.
create function public.schedule_push_retry(p_notification_id uuid, p_tokens text[], p_attempt integer default 0)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wait constant integer[] := array[1, 5, 15];
  v_next integer := coalesce(p_attempt, 0) + 1;
  v_count integer;
begin
  if v_next > cardinality(v_wait) then
    return 0;
  end if;
  insert into private.push_retries (notification_id, token, attempt, retry_at)
  select p_notification_id, t.token, v_next, now() + make_interval(mins => v_wait[v_next])
  from (select distinct unnest(p_tokens) as token) t
  on conflict (notification_id, token) do update
    set attempt = excluded.attempt, retry_at = excluded.retry_at;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.schedule_push_retry(uuid, text[], integer) from public, anon, authenticated;
grant execute on function public.schedule_push_retry(uuid, text[], integer) to service_role;

create function public.claim_push_retries(p_limit integer default 100)
returns table (notification_id uuid, type text, status text, order_id uuid,
               business_id uuid, business_name text, tokens text[], attempt integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_oldest timestamptz := now() - make_interval(mins => coalesce(
    (select s.int_value from public.app_settings s where s.key = 'push_claim_window_minutes'), 60));
begin
  delete from private.push_retries r
  using public.notifications n
  where n.id = r.notification_id and n.created_at <= v_oldest;

  return query
  with due as (
    delete from private.push_retries r
    where (r.notification_id, r.token) in (
      select x.notification_id, x.token from private.push_retries x
      where x.retry_at <= now()
      order by x.retry_at
      limit v_limit
      for update skip locked
    )
    returning r.notification_id, r.token, r.attempt
  )
  select n.id, n.type, n.status, n.order_id,
         coalesce(n.business_id, o.business_id),
         coalesce(o.business_name, b.name),
         array_agg(d.token order by d.last_seen_at desc),
         due.attempt
  from due
  join public.notifications n on n.id = due.notification_id
  join public.profiles pr on pr.id = n.user_id
  join public.device_tokens d on d.token = due.token and d.user_id = n.user_id
  left join public.orders o on o.id = n.order_id
  left join public.businesses b on b.id = n.business_id
  where case n.type
          when 'promotion' then pr.notify_promotions
          when 'business_review' then true
          else pr.notify_orders
        end
  group by n.id, n.type, n.status, n.order_id, n.business_id, o.business_id, o.business_name, b.name, due.attempt;
end;
$$;

revoke execute on function public.claim_push_retries(integer) from public, anon, authenticated;
grant execute on function public.claim_push_retries(integer) to service_role;

create or replace function private.push_work_pending()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.notifications n
    where n.pushed_at is null
      and (n.created_at <= now() - make_interval(mins => coalesce(
             (select s.int_value from public.app_settings s where s.key = 'push_claim_window_minutes'), 60))
           or exists (select 1 from public.device_tokens t where t.user_id = n.user_id))
  ) or exists (select 1 from private.push_retries r where r.retry_at <= now())
$$;

revoke execute on function private.push_work_pending() from public, anon, authenticated;

notify pgrst, 'reload schema';

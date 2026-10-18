-- -----------------------------------------------------------------------------
-- Migration: verification_access
-- Who reads and writes the verification data. NOT APPLIED YET.
--   - Legal data and documents: the owner reads them; writes them only while
--     the business is in draft or rejected; admins read them (and delete
--     documents). Nobody else, and no public or business view shows them.
--   - Admins read every business with its hours, menu and promotions.
--   - reports: each user creates (only about public businesses) and reads
--     only their own; admins manage them through RPCs (next migrations).
-- -----------------------------------------------------------------------------

create or replace function public.owns_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.businesses b
                 where b.id = p_business_id and b.owner_id = (select auth.uid()))
$$;

-- The owner may change verification data only before or after a rejection.
create or replace function public.owns_editable_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.businesses b
                 where b.id = p_business_id and b.owner_id = (select auth.uid())
                   and b.verification_status in ('draft', 'rejected'))
$$;

revoke execute on function public.owns_business(uuid) from public, anon;
revoke execute on function public.owns_editable_business(uuid) from public, anon;
grant execute on function public.owns_business(uuid) to authenticated;
grant execute on function public.owns_editable_business(uuid) to authenticated;

-- 1. Legal data ------------------------------------------------------------------
create policy "business_legal: owner or admin reads"
  on public.business_legal for select to authenticated
  using (public.owns_business(business_id) or public.is_admin());
create policy "business_legal: owner inserts while editable"
  on public.business_legal for insert to authenticated
  with check (public.owns_editable_business(business_id));
create policy "business_legal: owner updates while editable"
  on public.business_legal for update to authenticated
  using (public.owns_editable_business(business_id))
  with check (public.owns_editable_business(business_id));
create policy "business_legal: owner deletes while editable"
  on public.business_legal for delete to authenticated
  using (public.owns_editable_business(business_id));

revoke all on public.business_legal from public, anon, authenticated;
grant select, delete on public.business_legal to authenticated;
grant insert (business_id, tax_id, legal_name, legal_rep_name) on public.business_legal to authenticated;
grant update (tax_id, legal_name, legal_rep_name, updated_at) on public.business_legal to authenticated;

-- 2. Documents --------------------------------------------------------------------
create policy "business_docs: owner or admin reads"
  on public.business_verification_docs for select to authenticated
  using (public.owns_business(business_id) or public.is_admin());
create policy "business_docs: owner adds while editable"
  on public.business_verification_docs for insert to authenticated
  with check (public.owns_editable_business(business_id));
create policy "business_docs: owner while editable or admin deletes"
  on public.business_verification_docs for delete to authenticated
  using (public.owns_editable_business(business_id) or public.is_admin());

revoke all on public.business_verification_docs from public, anon, authenticated;
grant select, delete on public.business_verification_docs to authenticated;
grant insert (business_id, kind, storage_path) on public.business_verification_docs to authenticated;

-- 3. Admins read everything a review needs ------------------------------------------
create policy "businesses: admin reads" on public.businesses
  for select to authenticated using (public.is_admin());
create policy "business_hours: admin reads" on public.business_hours
  for select to authenticated using (public.is_admin());
create policy "menu_items: admin reads" on public.menu_items
  for select to authenticated using (public.is_admin());
create policy "promotions: admin reads" on public.promotions
  for select to authenticated using (public.is_admin());

-- 4. Reports ---------------------------------------------------------------------------
create table if not exists public.reports (
  id          uuid        not null default gen_random_uuid(),
  reporter    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  business_id uuid        not null references public.businesses (id) on delete cascade,
  reason      text        not null constraint reports_reason_valid
    check (reason in ('false_info', 'not_exists', 'inappropriate', 'other')),
  comment     text        constraint reports_comment_length check (comment is null or char_length(comment) <= 300),
  status      text        not null default 'open' constraint reports_status_valid
    check (status in ('open', 'reviewed', 'dismissed')),
  created_at  timestamptz not null default now(),
  constraint reports_pkey primary key (id)
);

-- One open report per user and business (no flooding).
create unique index if not exists reports_one_open_idx
  on public.reports (reporter, business_id) where status = 'open';

alter table public.reports enable row level security;

create policy "reports: reporter creates own"
  on public.reports for insert to authenticated
  with check (reporter = (select auth.uid()) and public.is_business_public(business_id));
create policy "reports: reporter reads own"
  on public.reports for select to authenticated
  using (reporter = (select auth.uid()));

revoke all on public.reports from public, anon, authenticated;
grant select on public.reports to authenticated;
grant insert (business_id, reason, comment) on public.reports to authenticated;

notify pgrst, 'reload schema';

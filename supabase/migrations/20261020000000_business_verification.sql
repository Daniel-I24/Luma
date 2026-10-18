-- -----------------------------------------------------------------------------
-- Migration: business_verification
-- Verification of businesses against false information. NOT APPLIED YET.
--
--   - businesses.verification_status (draft, pending, approved, rejected,
--     suspended), verification_note and verified_at. Clients never write
--     them (they are outside the column grants). Existing businesses are
--     demo data and start approved.
--   - admins: who reviews. No policy and no grant for clients; the app asks
--     am_i_admin().
--   - business_legal: tax id (NIT with DIAN check digit), legal name and
--     legal representative. Private: owner and admins only.
--   - business_verification_docs: RUT, facade photo and others, stored in
--     the private bucket verification-docs (next migrations).
-- -----------------------------------------------------------------------------

-- 1. Status ----------------------------------------------------------------------
alter table public.businesses
  add column if not exists verification_status text not null default 'draft'
    constraint businesses_verification_status_valid
    check (verification_status in ('draft', 'pending', 'approved', 'rejected', 'suspended')),
  add column if not exists verification_note text
    constraint businesses_verification_note_length
    check (verification_note is null or char_length(verification_note) <= 300),
  add column if not exists verified_at timestamptz;

-- Every business that exists today is demo data.
update public.businesses set verification_status = 'approved', verified_at = now();

-- 2. Admins ------------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint admins_pkey primary key (user_id)
);

alter table public.admins enable row level security;
revoke all on public.admins from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.admins a where a.user_id = (select auth.uid())) $$;

-- Policies call it as the requesting role, so authenticated may execute it.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.am_i_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select public.is_admin() $$;

revoke execute on function public.am_i_admin() from public, anon;
grant execute on function public.am_i_admin() to authenticated;

-- 3. NIT check digit (DIAN): weights 3, 7, 13, ... from the rightmost digit,
-- sum mod 11; remainder 0 or 1 is the digit, otherwise 11 - remainder.
-- Format check only: it does not prove the NIT exists.
create or replace function public.is_valid_nit(p_nit text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_weights int[] := array[3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  v_body text;
  v_sum int := 0;
  v_rest int;
begin
  if p_nit is null or p_nit !~ '^[0-9]{6,15}-[0-9]$' then
    return false;
  end if;
  v_body := split_part(p_nit, '-', 1);
  for i in 1 .. char_length(v_body) loop
    v_sum := v_sum + substr(v_body, char_length(v_body) - i + 1, 1)::int * v_weights[i];
  end loop;
  v_rest := v_sum % 11;
  return split_part(p_nit, '-', 2)::int = case when v_rest < 2 then v_rest else 11 - v_rest end;
end;
$$;

revoke execute on function public.is_valid_nit(text) from public, anon;
grant execute on function public.is_valid_nit(text) to authenticated;

-- 4. Legal data (private) -------------------------------------------------------------
create table if not exists public.business_legal (
  business_id    uuid        not null references public.businesses (id) on delete cascade,
  tax_id         text        not null constraint business_legal_tax_id_valid check (public.is_valid_nit(tax_id)),
  legal_name     text        not null
    constraint business_legal_name_length check (char_length(btrim(legal_name)) between 2 and 150),
  legal_rep_name text        not null
    constraint business_legal_rep_length check (char_length(btrim(legal_rep_name)) between 2 and 120),
  updated_at     timestamptz not null default now(),
  constraint business_legal_pkey primary key (business_id)
);

-- 5. Verification documents -------------------------------------------------------------
create table if not exists public.business_verification_docs (
  id           uuid        not null default gen_random_uuid(),
  business_id  uuid        not null references public.businesses (id) on delete cascade,
  kind         text        not null constraint business_docs_kind_valid check (kind in ('rut', 'facade', 'other')),
  storage_path text        not null constraint business_docs_path_unique unique,
  created_at   timestamptz not null default now(),
  constraint business_verification_docs_pkey primary key (id),
  constraint business_docs_path_shape check (
    storage_path = business_id::text || '/' || kind || '/' || split_part(storage_path, '/', 3)
    and split_part(storage_path, '/', 3) ~ '^[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'
  )
);

create index if not exists business_docs_business_idx on public.business_verification_docs (business_id);

alter table public.business_legal enable row level security;
alter table public.business_verification_docs enable row level security;

notify pgrst, 'reload schema';

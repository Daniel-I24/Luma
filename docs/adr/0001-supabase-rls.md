# 0001 — Supabase with RLS as the only backend

**Context.** A small team, a mobile-first app, payments and private data.

**Decision.** Postgres on Supabase is the source of truth. Every table has
RLS; the app holds only the anon key and the user's JWT. What clients must
not do directly goes through `SECURITY DEFINER` functions with an empty
`search_path` and explicit grants; provider secrets live only in Edge
Functions. Migrations are append-only (an applied file is never edited).

**Consequences.** Every rule is enforced twice (zod in the app, CHECK/RLS in
the database) and tested in `supabase/tests` (SQL suites per role). Schema
changes need a new migration and a "reload schema".

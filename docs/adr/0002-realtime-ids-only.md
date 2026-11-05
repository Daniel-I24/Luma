# 0002 — Realtime through ids-only event tables

**Context.** Postgres changes on real tables would leak columns and need RLS
on every replicated table; the free plan limits messages.

**Decision.** Triggers write `catalog_events` and `order_events` (ids, a kind
and a time); `supabase_realtime` publishes only those. Screens re-read with
their usual RLS queries, in 500 ms batches, and poll every 30 s while the
channel is down. Since migration 57 an order change writes one row per
audience, so an owner never receives a customer id.

**Consequences.** One extra read per batch; no row data in the socket.
docs/realtime.md has the limits and the screens that listen.

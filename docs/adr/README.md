# Architecture decision records

One file per decision that shapes the code for a long time: the context, the
decision and its consequences. Day-to-day choices stay in docs/DECISIONS.md.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-supabase-rls.md) | Supabase with RLS as the only backend; the app holds the anon key | Accepted |
| [0002](0002-realtime-ids-only.md) | Realtime through event tables that carry ids only | Accepted |
| [0003](0003-user-facing-errors.md) | Only errors the user can act on reach the global notice | Accepted |
| [0004](0004-password-rule.md) | One password rule, equal to Supabase's | Accepted |
| [0005](0005-routing-chain.md) | Routing chain: OpenRouteService, public OSM, straight line | Accepted |

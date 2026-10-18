# Luma IA

Two features use it:

- **Customers** (`/ai`): places and a combo for a moment of the day, a
  one-sentence reason and "Otra opción"; in a restaurant's Promos tab, the
  "Recomendada por Luma IA" label.
- **Owners** (Luma Negocios): "Ideas de Luma IA" in the Summary and in
  Promos. Each idea shows the reason (translated, with the real figures),
  the final price and "Crear promoción", which only opens the form. **The AI
  never publishes anything** and "Revisa tu margen antes de publicar" is
  always visible.

## Two modes

`src/app/core/config/ai-mode.ts` → `AI_MODE`:

| Mode | What runs | Needs |
| --- | --- | --- |
| `rules` (default) | Rules in the app: `RulesRecommendationEngine` and `RulesPromotionAdvisor` (sales aggregates from `owner_sales_summary`) | Migrations only |
| `remote` | Edge Functions `recommend` and `suggest-promotions` through the LLM gateway; **any failure falls back to the rules** | Functions deployed and their secrets set |

Both modes sit behind the same contracts (`RecommendationEngine`,
`PromotionAdvisor`), so callers never change. Switch to `remote` only after
deploying (below).

The "Recomendada por Luma IA" label marks the promotion with the biggest
discount on an available item; it does not call any model.

## Architecture (remote)

```
app ──JWT──▶ recommend / suggest-promotions (Edge Functions)
               │  caller's own client: getUser, consume_ai_quota,
               │  ai_recommend_candidates / owner_sales_summary (RLS, owner checks)
               │  service role: ai_cache_get / ai_cache_put only
               └─▶ _shared/llm ──▶ Gemini | OpenAI-compatible (Groq, OpenRouter) | Anthropic
```

- `supabase/functions/_shared/llm/`: provider-neutral gateway
  (`generateJson` → validated object or `ai_unavailable`), 10 s timeout, one
  retry (timeouts, network, 429, 5xx), JSON-only modes, nothing logged. No
  Luma imports: copy the folder to reuse it (`_shared/llm/README.md`).
- `recommend`: POST, CORS allow list, JWT, body ≤ 2 KB (moment, location,
  radius ≤ 10 km). Candidates are public businesses open at that time
  (`ai_recommend_candidates`, location rounded to 2 decimals) with rating,
  current promotions and up to 4 items. Answer: up to 3 businesses with a
  reason code and a combo, priced on the server with the current discounts.
  Cache 20 min.
- `suggest-promotions`: POST, JWT, only owners of an **approved** business
  (checked with the owner's client, never the service role; 403 otherwise).
  Model input: `owner_sales_summary` aggregates (60 days: units per item,
  orders per weekday and slot, cancel rate; no ids or customer data). Up to
  3 ideas `{item, 5–30 %, 1–14 days, reason}`; ideas on items with a running
  promotion are dropped; prices and figures computed on the server. Below 10
  orders in 60 days a rules advisor answers instead of the model. Cache 24 h.
- Quotas (`consume_ai_quota`, `app_settings`): `ai_daily_per_user` (20),
  `ai_daily_per_business` (10), `ai_daily_global` (500); over the limit →
  429 and the app uses its rules.

### Security

- Business texts (names, items) are untrusted: they travel as JSON data and
  the instructions tell the model never to follow them.
- The model only returns ids and reason codes from closed lists; strict
  validation rejects anything else (ids outside the candidate set, numbers
  out of range, unknown codes) → 503 `ai_unavailable` → rules.
- No user data in prompts: no ids, emails or exact location.
- Prices and totals are always recomputed by the server; `create_order`
  recomputes them again when ordering.

## Getting a free key

Free tiers change often: check each console for the current models and
limits before choosing `LLM_MODEL` (the code never fixes a model).

| Provider | Where | `LLM_PROVIDER` | `LLM_BASE_URL` |
| --- | --- | --- | --- |
| Google AI Studio (Gemini API) | aistudio.google.com → Get API key | `gemini` | — |
| Groq | console.groq.com → API Keys | `openai` | `https://api.groq.com/openai/v1` (default) |
| OpenRouter (free models marked `:free`) | openrouter.ai → Keys | `openai` | `https://openrouter.ai/api/v1` |
| Anthropic (paid) | platform.claude.com → API keys | `anthropic` | — |

Formats were checked on 2026-10-18 against each provider's documentation
and are covered by tests with a fake `fetch`: Gemini `generateContent` with
`x-goog-api-key` and `responseMimeType: application/json`; OpenAI-compatible
`/chat/completions` with `response_format: json_object`; Anthropic
`/v1/messages` with `anthropic-version: 2023-06-01` and
`output_config.format` (`json_schema`).

**Privacy**: free plans may use the requests to improve their models. That
is why prompts never contain personal data. Review each provider's terms
before production.

## Deploying (manual)

```sh
supabase secrets set LLM_PROVIDER=gemini LLM_MODEL=<model-id> LLM_API_KEY=<key>
# for Groq/OpenRouter: LLM_PROVIDER=openai LLM_BASE_URL=https://openrouter.ai/api/v1
supabase secrets set ALLOWED_ORIGINS="https://localhost,https://<vercel-domain>"
supabase functions deploy recommend
supabase functions deploy suggest-promotions
```

Apply migrations `20261021000000` and `20261022000000` first. Then set
`AI_MODE` to `'remote'` and deploy the app. Changing provider is only
`supabase secrets set ...` (no redeploy of the app). To limit spend, lower
the quotas in `app_settings`.

## Tests

- `supabase/functions/_shared`: `deno test --no-lock --config deno.json`
  (gateway), and the same in `recommend/` and `suggest-promotions/`
  (injection text in names, ids outside the set, timeouts, quota, cache,
  403 for another owner's business).
- SQL: `supabase/tests/ai_gateway.sql`.
- App: engines, advisors and UI specs (`npm test`).

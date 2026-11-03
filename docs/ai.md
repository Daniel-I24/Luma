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

The build sets it (round 8): `AI_MODE=remote` in the environment of
`npm run build:prod` or `npm run apk:release` becomes
`ng build --define LUMA_AI_MODE='remote'` (`scripts/build-flags.mjs`), which
`src/app/core/config/ai-mode.ts` reads. Without it the app is in `rules`.
Before round 8 nothing read the variable, so every build was in rules mode
and "Escanear menú" said Luma IA was not available.

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
  When the model is not configured or fails, it answers 200 with the rules
  (`source: "rules"`); the cases shared with the app's rules live in
  `src/app/shared/promotions/advisor/rule-ideas.cases.json`.
- `extract-menu`: POST, JWT, only the owner of the business (any status, so
  a draft can fill its menu). Body: `{ business_id, images: [base64] }`, 1
  to 4 photos, 8 MB per request (rejected by `Content-Length` before
  reading), 2 MB per decoded image, JPEG/PNG/WebP checked by magic bytes.
  Order of checks, cheapest first: bounded body, JSON shape (no decoding),
  session, ownership, rate limit `hit_rate_limit('menu_scan')`
  (`rate_menu_scan_max` 6 requests per `rate_menu_scan_window_seconds`
  600, answered `429 rate_limited`), and only then the images are decoded.
  Only the photos reach the model (no business or owner data). Answer: a
  draft `{ items: [{ name, description, price_cop, section }] }` (at most
  200, plain text cut to the `menu_items` limits, prices such as "$12.500"
  parsed to whole COP or null). Nothing is saved: the owner reviews the
  draft and the app writes the accepted items through RLS. Quota
  `consume_menu_scan_quota`: `menu_scan_daily_per_business` (5), also
  counted in the user and global limits. Uses `LLM_VISION_MODEL` when set
  (a model that reads images), `LLM_MODEL` otherwise; 30 s timeout.
- Quotas (`consume_ai_quota`, `app_settings`): `ai_daily_per_user` (20),
  `ai_daily_per_business` (10), `ai_daily_global` (500); over the limit →
  429 and the app uses its rules. The quota is spent only right before a
  model call: cached answers, empty candidate lists and rules are free.
  The recommend cache key includes the area (coordinates rounded to about
  1 km) and the 20-minute window.

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
supabase functions deploy extract-menu
# optional, a model that reads images for extract-menu:
supabase secrets set LLM_VISION_MODEL=<vision-model-id>
```

Check the deployment with `node scripts/ai-smoke.mjs` (see its header):
it calls each function with a test account and prints only status codes
and shapes, never keys or answers.

Apply migrations `20261021000000`, `20261022000000` and `20261025000000` first. Then build
with `AI_MODE=remote` (web and APK) and deploy the app. Changing provider is only
`supabase secrets set ...` (no redeploy of the app). To limit spend, lower
the quotas in `app_settings`.

## Comprobar cada caso ("Escanear menú")

Cada fallo tiene su mensaje en la app y una línea en Mi negocio → Ayuda →
"Información técnica" (modo de Luma IA y la última lectura de extract-menu
con su estado y códigos, nunca una clave ni un texto del proveedor).

| Lo que ves | Causa | Cómo comprobarlo |
| --- | --- | --- |
| "Esta versión de la app se compiló en modo reglas" (botón deshabilitado con ese motivo) | La compilación no recibió `AI_MODE=remote` | "Información técnica" → Modo de Luma IA = `rules`. La salida de `npm run apk:release` / `build:prod` imprime `AI_MODE: …`. Vuelve a compilar con `AI_MODE=remote`. |
| "Ya usaste los escaneos de hoy" / "Enviaste muchos escaneos seguidos" | Cuota diaria (429 `quota_exceeded`) o límite por minutos (429 `rate_limited`) | `app_settings` (`ai_*`, `rate_menu_scan_*`). |
| "El servicio que lee las fotos no está publicado" | 404: `extract-menu` no desplegada | `supabase functions list`; `supabase functions deploy extract-menu`. |
| "El servicio que lee las fotos no respondió" | Sin respuesta, función caída (502/504) o CORS (el origen no está en `ALLOWED_ORIGINS`) | Logs de la función; `ALLOWED_ORIGINS` incluye el origen de la web y `capacitor://localhost` / `https://localhost` del APK. |
| "Luma IA no tiene configurado su proveedor" | 503 `not_configured`: faltan `LLM_PROVIDER` / `LLM_API_KEY` | `supabase secrets list` (solo nombres). |
| "El proveedor de Luma IA rechazó la clave" | 503 `provider_auth`: el proveedor respondió 401/403 | Revisa `LLM_API_KEY` (Gemini: clave de AI Studio activa). |
| "El proveedor no reconoce el modelo" | 503 `provider_model`: 404 del proveedor | `LLM_VISION_MODEL` / `LLM_MODEL` (debe leer imágenes). |
| "El proveedor de Luma IA está saturado" | 503 `provider_rate_limit`: 429 del proveedor | Espera o cambia de plan/modelo. |
| "Luma IA tardó demasiado" | 503 `timeout` | Menos fotos, o un modelo más rápido. |

En todos los casos el botón de elegir o tomar fotos sigue visible y "Pegar
mi menú como texto" sigue disponible.

## Tests

- `supabase/functions/_shared`: `deno test --no-lock --config deno.json`
  (gateway), and the same in `recommend/` and `suggest-promotions/`
  (injection text in names, ids outside the set, timeouts, quota, cache,
  403 for another owner's business), and `extract-menu/` (magic bytes,
  size limits, price parsing, sanitising, quota only before the model).
- SQL: `supabase/tests/ai_gateway.sql`, `supabase/tests/menu_scan_quota.sql`.
- App: engines, advisors and UI specs (`npm test`).

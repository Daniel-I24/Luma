# Luma IA

Luma IA recommends places and combos for a moment of the day
(`/ai`, feature `features/ai`). **Today it is a deterministic rules engine
that runs in the app**; no language model and no external API is involved.
The UI may say "Luma IA" but never claims to use a language model.

## Contract

`src/app/shared/recommendations/`

| File | Role |
| --- | --- |
| `recommendation.model.ts` | Types: `DayMoment`, `RecommendationCandidate`, `Recommendation`, `Combo` |
| `recommendation-engine.ts` | `RecommendationEngine` interface + `RECOMMENDATION_ENGINE` token |
| `rules-recommendation.engine.ts` | v1 implementation (pure functions) |
| `recommendation-rules.ts` | Typed rules data (moments, categories, weights, section roles) |
| `combo.util.ts` | Main + side + drink of one business |

`AiStore` gathers the candidates (nearby businesses, hours, ratings,
promotions and available menu items, one `in` query per table) and calls
`engine.recommend({ moment, candidates })`. The method is async on purpose,
so replacing the engine needs no change in callers.

## Rules (v1)

- **Moment**: preselected from the current hour (breakfast 05–10, mid-morning
  10–12, lunch 12–15, afternoon 15–18, dinner 18–22, late night 22–05). The
  user can pick another one.
- **Eligible**: only businesses that are open, closing soon or opening soon.
- **Score**: category suits the moment (+40), distance when the user shared
  their location (up to +25, nothing from 5 km), average rating (up to +20),
  active promotion (+10), favourite (+15), opening soon (−5). Top 3 win; ties
  break by name.
- **Combo**: from the best recommended business whose menu covers the three
  roles. Sections map to roles with a keyword dictionary (`Bebidas` → drink,
  `Entradas`/`Repostería` → side, `Platos fuertes`/`Desayunos` → main); the
  first available item of each role in the owner's order is chosen. Without
  a valid combo only businesses are shown.
- Prices shown are informative: the server recalculates every price when an
  order is created (`create_order`, see `docs/orders.md`).

## Next: Claude behind the same interface

The rules engine will be replaced by a `ClaudeRecommendationEngine` that
calls a Supabase Edge Function. Requirements for that step (not built):

- The Claude API key lives only in the Edge Function secrets; the app never
  sees it.
- The function authenticates the caller (JWT), applies per-user rate limits
  and caps prompt size.
- The app sends candidate ids and the moment, never free-form prompts; the
  function builds the prompt from server-side data.
- The model's answer is untrusted: it is validated against a schema (Zod)
  and every business/item id must exist and be available.
- Prices and totals are always recalculated on the server; the model never
  sets a price.
- If the function fails or times out, the app falls back to the rules engine.

Swapping is a provider change:
`{ provide: RECOMMENDATION_ENGINE, useClass: ClaudeRecommendationEngine }`.

# `_shared/llm` — swappable LLM gateway

Self-contained (no Luma imports, no npm packages): copy the folder into any
Deno or Supabase Edge Functions project.

```ts
import { providerFromEnv } from '../_shared/llm/config.ts';

const llm = providerFromEnv((name) => Deno.env.get(name));
if (!llm) return unavailable(); // missing secrets: use your fallback

const result = await llm.generateJson(
  { system, user, schema, maxTokens: 512 },
  (value) => strictValidator(value), // returns null when the shape or ids are wrong
);
if (!result.ok) return unavailable(); // result.reason is for tests, never shown
```

| Secret | Values |
| --- | --- |
| `LLM_PROVIDER` | `gemini` (Google AI Studio), `openai` (any OpenAI-compatible API: Groq, OpenRouter...), `anthropic` |
| `LLM_MODEL` | model id of that provider (never hard-coded here) |
| `LLM_API_KEY` | the provider key |
| `LLM_BASE_URL` | optional; for `openai` e.g. `https://api.groq.com/openai/v1` (default) or `https://openrouter.ai/api/v1` |

Behaviour:

- 10 s timeout per attempt, one retry on timeouts, network errors, 429 and
  5xx; other 4xx fail at once.
- Every failure is `{ ok: false, error: 'ai_unavailable' }`.
- JSON only: Gemini `responseMimeType: application/json`, OpenAI-compatible
  `response_format: json_object`, Anthropic `output_config.format`
  (`json_schema`). The answer is always parsed and validated by the caller's
  validator; a model can never return free text to the user.
- It never logs keys, prompts or answers.

Tests: `deno test --no-lock --config ../deno.json` from `_shared` (fake
`fetch`, no network).

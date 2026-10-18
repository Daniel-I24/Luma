import { bearerToken, json, preflight, readJson, sha256 } from '../_shared/edge.ts';
import type { LlmProvider } from '../_shared/llm/types.ts';
import type { Candidate, Recommendation } from './model.ts';
import { buildPrompt, cacheMaterial } from './prompt.ts';
import { answerValidator, parseInput, priceRecommendation } from './validate.ts';

/** What the function may do as the caller (their own JWT, never the service role). */
export interface CallerApi {
  consumeQuota(): Promise<boolean>;
  candidates(lat: number, lng: number, radiusKm: number, at: string): Promise<Candidate[] | null>;
}

/** Server-only cache (service role). */
export interface AnswerCache {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

export interface RecommendDeps {
  readonly allowedOrigins: readonly string[];
  /** Validates the JWT (auth.getUser) and returns the caller's API, or null. */
  authenticate(token: string): Promise<CallerApi | null>;
  readonly cache: AnswerCache;
  /** Null when the LLM secrets are missing. */
  readonly llm: LlmProvider | null;
  readonly now?: () => Date;
}

/** Customers: 20 minutes (the candidates change through the day). */
export const CACHE_TTL_SECONDS = 20 * 60;

export function createHandler(deps: RecommendDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const checked = preflight(req, deps.allowedOrigins);
    if ('response' in checked) return checked.response;
    const { cors } = checked;
    const unavailable = () => json(503, { error: 'ai_unavailable' }, cors);

    try {
      const input = parseInput(await readJson(req), (deps.now ?? (() => new Date()))());
      if (!input) return json(400, { error: 'invalid_request' }, cors);
      const token = bearerToken(req);
      const caller = token ? await deps.authenticate(token) : null;
      if (!caller) return json(401, { error: 'unauthorized' }, cors);
      if (!deps.llm) return unavailable();
      if (!(await caller.consumeQuota())) return json(429, { error: 'quota_exceeded' }, cors);

      const candidates = await caller.candidates(input.lat, input.lng, input.radiusKm, input.at);
      if (!candidates) return unavailable();
      if (candidates.length === 0) return json(200, { businesses: [], combo: null }, cors);

      const key = `recommend:${await sha256(cacheMaterial(input, candidates))}`;
      const cached = await deps.cache.get(key).catch(() => null);
      if (cached) return json(200, cached, cors);

      const answer = await deps.llm.generateJson(buildPrompt(input, candidates), answerValidator(candidates));
      if (!answer.ok) return unavailable();
      const result: Recommendation = priceRecommendation(answer.value, candidates);
      await deps.cache.put(key, result, CACHE_TTL_SECONDS).catch(() => undefined);
      return json(200, result, cors);
    } catch {
      return unavailable();
    }
  };
}

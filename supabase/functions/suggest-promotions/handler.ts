import { bearerToken, json, preflight, readJson, sha256 } from '../_shared/edge.ts';
import type { LlmProvider } from '../_shared/llm/types.ts';
import { finalizeIdeas, ruleIdeas } from './ideas.ts';
import { type IdeasResponse, MIN_ORDERS_FOR_AI, type SalesSummary } from './model.ts';
import { buildPrompt, ideasValidator } from './prompt.ts';

/** What the function may do as the caller (their JWT; RLS and the RPCs decide). */
export interface OwnerApi {
  /** True only when the caller owns the business and it is approved. */
  ownsApprovedBusiness(businessId: string): Promise<boolean>;
  consumeQuota(businessId: string): Promise<boolean>;
  salesSummary(businessId: string): Promise<SalesSummary | null>;
  /** Items that already have a running promotion. */
  promotedItems(businessId: string): Promise<Set<string> | null>;
}

export interface SuggestDeps {
  readonly allowedOrigins: readonly string[];
  authenticate(token: string): Promise<OwnerApi | null>;
  readonly cache: {
    get(key: string): Promise<unknown>;
    put(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  };
  readonly llm: LlmProvider | null;
}

/** Owners: 24 hours (sales aggregates move slowly). */
export const CACHE_TTL_SECONDS = 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function createHandler(deps: SuggestDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const checked = preflight(req, deps.allowedOrigins);
    if ('response' in checked) return checked.response;
    const { cors } = checked;
    const unavailable = () => json(503, { error: 'ai_unavailable' }, cors);

    try {
      const body = await readJson(req);
      const businessId = typeof body === 'object' && body !== null && 'business_id' in body ? body.business_id : null;
      if (typeof businessId !== 'string' || !UUID.test(businessId)) return json(400, { error: 'invalid_request' }, cors);
      const token = bearerToken(req);
      const owner = token ? await deps.authenticate(token) : null;
      if (!owner) return json(401, { error: 'unauthorized' }, cors);
      if (!(await owner.ownsApprovedBusiness(businessId))) return json(403, { error: 'forbidden' }, cors);
      if (!(await owner.consumeQuota(businessId))) return json(429, { error: 'quota_exceeded' }, cors);

      const [summary, promoted] = await Promise.all([
        owner.salesSummary(businessId),
        owner.promotedItems(businessId),
      ]);
      if (!summary || !promoted) return unavailable();
      if (summary.orders < MIN_ORDERS_FOR_AI) {
        const ideas = finalizeIdeas(ruleIdeas(summary, promoted), summary, promoted);
        return json(200, { source: 'rules', ideas } satisfies IdeasResponse, cors);
      }
      if (!deps.llm) return unavailable();

      const key = `suggest:${await sha256(JSON.stringify([businessId, summary, [...promoted].sort()]))}`;
      const cached = await deps.cache.get(key).catch(() => null);
      if (cached) return json(200, cached, cors);
      const answer = await deps.llm.generateJson(buildPrompt(summary), ideasValidator(summary));
      if (!answer.ok) return unavailable();
      const result: IdeasResponse = { source: 'ai', ideas: finalizeIdeas(answer.value, summary, promoted) };
      await deps.cache.put(key, result, CACHE_TTL_SECONDS).catch(() => undefined);
      return json(200, result, cors);
    } catch {
      return unavailable();
    }
  };
}

import { bearerToken, json, preflight, readJson } from '../_shared/edge.ts';
import type { LlmProvider } from '../_shared/llm/types.ts';
import { type MenuDraft, toDraft } from './draft.ts';
import { decodeImages, MAX_BODY_BYTES, parseEnvelope } from './images.ts';
import { buildPrompt } from './prompt.ts';

/** What the function may do as the caller (their JWT; RLS and the RPCs decide). */
export interface OwnerApi {
  ownsBusiness(businessId: string): Promise<boolean>;
  /** hit_rate_limit('menu_scan'): false when the caller sent too many requests lately. */
  withinRateLimit(): Promise<boolean>;
  /** consume_menu_scan_quota: false when a daily limit is reached. */
  consumeQuota(businessId: string): Promise<boolean>;
}

export interface ExtractDeps {
  readonly allowedOrigins: readonly string[];
  authenticate(token: string): Promise<OwnerApi | null>;
  /** Null when the LLM secrets are missing: the app offers manual entry. */
  readonly llm: LlmProvider | null;
}

/**
 * Reads up to 4 photos of a menu and answers a draft ({ items }) for the
 * owner to review. Nothing is saved here: the app writes the menu items the
 * owner accepts, through RLS. Checks, cheapest first: bounded body, JSON
 * shape, session, ownership, rate limit; only then are images decoded.
 */
export function createHandler(deps: ExtractDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const checked = preflight(req, deps.allowedOrigins);
    if ('response' in checked) return checked.response;
    const { cors } = checked;
    const unavailable = () => json(503, { error: 'ai_unavailable' }, cors);

    try {
      const token = bearerToken(req);
      if (!token) return json(401, { error: 'unauthorized' }, cors);
      const envelope = parseEnvelope(await readJson(req, MAX_BODY_BYTES));
      if (!envelope) return json(400, { error: 'invalid_request' }, cors);
      const owner = await deps.authenticate(token);
      if (!owner) return json(401, { error: 'unauthorized' }, cors);
      if (!(await owner.ownsBusiness(envelope.businessId))) return json(403, { error: 'forbidden' }, cors);
      if (!(await owner.withinRateLimit())) return json(429, { error: 'rate_limited' }, cors);
      const images = decodeImages(envelope.encodedImages);
      if (!images) return json(400, { error: 'invalid_request' }, cors);
      if (!deps.llm) return unavailable();
      // Spent right before the model call only.
      if (!(await owner.consumeQuota(envelope.businessId))) return json(429, { error: 'quota_exceeded' }, cors);

      const answer = await deps.llm.generateJson(buildPrompt(images), toDraft);
      if (!answer.ok) return unavailable();
      return json(200, answer.value satisfies MenuDraft, cors);
    } catch {
      return unavailable();
    }
  };
}

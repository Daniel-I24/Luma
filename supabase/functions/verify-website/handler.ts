import { bearerToken, json, preflight, readJson } from '../_shared/edge.ts';
import { containsCode, type FetchLike, fetchVerificationFile, type Resolver, verificationUrl } from './ssrf.ts';

/** start_website_check as the caller: their pending website request (one of today's 3 checks). */
export interface CallerApi {
  startCheck(businessId: string): Promise<
    { readonly verificationId: string; readonly website: string; readonly code: string } | { readonly error: string }
  >;
}

export interface VerifyWebsiteDeps {
  readonly allowedOrigins: readonly string[];
  authenticate(token: string): Promise<CallerApi | null>;
  /** complete_website_check as service_role. */
  complete(verificationId: string): Promise<boolean>;
  readonly resolve: Resolver;
  readonly fetchFn: FetchLike;
}

const UUID = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
/** Database refusals and their HTTP answer. */
const REFUSALS: Readonly<Record<string, number>> = {
  not_owner: 403,
  email_not_confirmed: 403,
  too_many_checks: 429,
  no_pending_request: 409,
  auto_disabled: 409,
};

/**
 * verify-website — the owner asks Luma to look for its code at
 * https://<domain>/.well-known/luma-verification.txt. JWT and ownership in
 * the database (start_website_check: confirmed e-mail, 3 a day per
 * business); the download follows the SSRF rules of ssrf.ts; a line equal
 * to the code verifies the website (complete_website_check). Answers
 * `{ verified, reason? }`; never the content of the page.
 */
export function createHandler(deps: VerifyWebsiteDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const checked = preflight(req, deps.allowedOrigins);
    if ('response' in checked) return checked.response;
    const { cors } = checked;
    try {
      const body = (await readJson(req)) as { business_id?: unknown } | null;
      const businessId = typeof body?.business_id === 'string' && UUID.test(body.business_id) ? body.business_id : null;
      if (!businessId) return json(400, { error: 'invalid_request' }, cors);
      const token = bearerToken(req);
      const caller = token ? await deps.authenticate(token) : null;
      if (!caller) return json(401, { error: 'unauthorized' }, cors);

      const started = await caller.startCheck(businessId);
      if ('error' in started) return json(REFUSALS[started.error] ?? 400, { error: started.error }, cors);
      const url = verificationUrl(started.website);
      if (!url) return json(200, { verified: false, reason: 'blocked' }, cors);
      const file = await fetchVerificationFile(url, deps.resolve, deps.fetchFn);
      if (file.kind !== 'ok') return json(200, { verified: false, reason: file.kind }, cors);
      if (!containsCode(file.text, started.code)) return json(200, { verified: false, reason: 'mismatch' }, cors);
      const verified = await deps.complete(started.verificationId);
      return json(200, verified ? { verified: true } : { verified: false, reason: 'changed' }, cors);
    } catch {
      return json(503, { error: 'verify_unavailable' }, cors);
    }
  };
}

import { corsHeaders, isOriginAllowed } from './cors.ts';

/** Small HTTP helpers shared by the JSON Edge Functions (POST only, CORS allow list). */

export const MAX_BODY_BYTES = 2048;

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

const BEARER = /^Bearer\s+(\S+)$/i;

export function bearerToken(req: Request): string | null {
  return req.headers.get('Authorization')?.match(BEARER)?.[1] ?? null;
}

/**
 * Origin, preflight and method checks. Returns the CORS headers to use, or
 * the response to send right away.
 */
export function preflight(
  req: Request,
  allowedOrigins: readonly string[],
): { cors: Record<string, string> } | { response: Response } {
  const origin = req.headers.get('Origin');
  const cors = corsHeaders(origin, allowedOrigins);
  if (!isOriginAllowed(origin, allowedOrigins)) {
    return { response: json(403, { error: 'origin_not_allowed' }, cors) };
  }
  if (req.method === 'OPTIONS') return { response: new Response(null, { status: 204, headers: cors }) };
  if (req.method !== 'POST') {
    return { response: json(405, { error: 'method_not_allowed' }, { ...cors, Allow: 'POST, OPTIONS' }) };
  }
  return { cors };
}

/** Reads a JSON body of at most maxBytes; null when too big or not JSON. */
export async function readJson(req: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Hex SHA-256, for cache keys. */
export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Final price after a percent off: round to the nearest peso, halves up (= public.promotion_price). */
export function promotionPrice(listCop: number, percent: number | null): number {
  return percent === null ? listCop : Math.round((listCop * (100 - percent)) / 100);
}

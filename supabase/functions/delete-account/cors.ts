const LOCAL_DEV_ORIGIN = 'http://localhost:4200';

const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type';

/** Local dev origin plus the one configured through ALLOWED_ORIGIN, if any. */
export function allowedOriginsFrom(configured: string | undefined): readonly string[] {
  const extra = configured?.trim();
  return extra ? [LOCAL_DEV_ORIGIN, extra] : [LOCAL_DEV_ORIGIN];
}

/** Requests without Origin come from non-browser clients; the JWT still guards them. */
export function isOriginAllowed(origin: string | null, allowed: readonly string[]): boolean {
  return origin === null || allowed.includes(origin);
}

export function corsHeaders(origin: string | null, allowed: readonly string[]): Record<string, string> {
  if (origin === null || !allowed.includes(origin)) {
    return { Vary: 'Origin' };
  }
  return {
    Vary: 'Origin',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Max-Age': '600',
  };
}

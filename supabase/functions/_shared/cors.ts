const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type';

/**
 * Exact origins from ALLOWED_ORIGINS (comma-separated) plus the legacy single
 * ALLOWED_ORIGIN. Empty entries and entries with a wildcard are ignored.
 */
export function allowedOriginsFrom(
  list: string | undefined,
  legacy?: string | undefined,
): readonly string[] {
  const entries = [...(list ?? '').split(','), legacy ?? '']
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '' && !entry.includes('*'));
  return [...new Set(entries)];
}

/** Requests without Origin come from non-browser clients; the JWT still guards them. */
export function isOriginAllowed(origin: string | null, allowed: readonly string[]): boolean {
  return origin === null || allowed.includes(origin);
}

export function corsHeaders(
  origin: string | null,
  allowed: readonly string[],
): Record<string, string> {
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

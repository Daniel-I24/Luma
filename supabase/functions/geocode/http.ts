/** Injectable fetch, so tests never reach the network. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export const GEOCODE_TIMEOUT_MS = 5_000;

export class GeocodeFailure extends Error {}

/** GET JSON with a timeout and no retry (the cache and the quota cover the rest). Never logs. */
export async function getJson(
  fetchFn: FetchLike,
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = GEOCODE_TIMEOUT_MS,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, { method: 'GET', headers, signal: controller.signal });
    if (!response.ok) {
      await response.body?.cancel();
      throw new GeocodeFailure(`http_${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw error instanceof GeocodeFailure ? error : new GeocodeFailure('network');
  } finally {
    clearTimeout(timer);
  }
}

/** Reads a nested value without trusting the response shape. */
export function at(value: unknown, ...path: (string | number)[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

export const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value));

/** Injectable fetch, so tests never reach the network. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const GEOCODE_TIMEOUT_MS = 5_000;

class GeocodeFailure extends Error {}

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

/** Reads a nested value without trusting the response shape (the LLM gateway's helper). */
export { at } from '../_shared/llm/http.ts';

export const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value));

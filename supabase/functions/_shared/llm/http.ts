import type { FetchLike, LlmFailureReason, LlmResult, LlmValidator } from './types.ts';

export const DEFAULT_TIMEOUT_MS = 10_000;
/** One retry on timeouts, network errors, 429 and 5xx. */
const RETRIES = 1;

export class LlmFailure extends Error {
  constructor(readonly reason: LlmFailureReason) {
    super(reason);
  }
}

/**
 * POSTs JSON with a timeout and one retry. Never logs: bodies hold prompts
 * and headers hold keys.
 */
export async function postJson(
  fetchFn: FetchLike,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  let last: LlmFailure = new LlmFailure('network');
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchFn(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.ok) {
        try {
          return await response.json();
        } catch {
          throw new LlmFailure('invalid_json');
        }
      }
      await response.body?.cancel();
      last = new LlmFailure('http_error');
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      // A body that is not JSON will not get better on a retry.
      if (error instanceof LlmFailure) throw error;
      last = new LlmFailure(controller.signal.aborted ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}

/** Parses the model's text as JSON (tolerating a ```json fence) and validates it. */
export function parseAnswer<T>(text: string | null, validate: LlmValidator<T>): LlmResult<T> {
  if (text === null) return fail('invalid_shape');
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return fail('invalid_json');
  }
  const value = validate(parsed);
  return value === null ? fail('invalid_shape') : { ok: true, value };
}

export function fail<T>(reason: LlmFailureReason): LlmResult<T> {
  return { ok: false, error: 'ai_unavailable', reason };
}

/** Runs a provider call, turning any failure into ai_unavailable. */
export async function guard<T>(call: () => Promise<LlmResult<T>>): Promise<LlmResult<T>> {
  try {
    return await call();
  } catch (error) {
    return fail(error instanceof LlmFailure ? error.reason : 'network');
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

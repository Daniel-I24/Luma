import type { FetchLike, LlmFailureReason, LlmResult, LlmValidator } from './types.ts';

const DEFAULT_TIMEOUT_MS = 10_000;
/** A saturated provider (5xx, "overloaded") gets two more tries; a timeout or network error one. */
const UNAVAILABLE_RETRIES = 2;
const TIMEOUT_RETRIES = 1;
/** First wait before a retry; it doubles each time, plus up to half of it at random. */
const RETRY_BASE_DELAY_MS = 500;
const UNAVAILABLE_STATUSES = new Set([500, 502, 503, 504, 529]);

// A plain field, not a parameter property: scripts/ai-smoke.mjs runs this file in Node (types stripped).
class LlmFailure extends Error {
  readonly reason: LlmFailureReason;

  constructor(reason: LlmFailureReason) {
    super(reason);
    this.reason = reason;
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Growing wait with jitter, so many clients do not retry at the same moment. */
function backoff(attempt: number, baseMs: number): number {
  const wait = baseMs * 2 ** attempt;
  return wait + Math.random() * (wait / 2);
}

/**
 * POSTs JSON with a timeout and retries: twice when the provider is
 * saturated, once on a timeout or network error. Never logs: bodies hold
 * prompts and headers hold keys.
 */
export async function postJson(
  fetchFn: FetchLike,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryDelayMs = RETRY_BASE_DELAY_MS,
): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const failure = await attemptPost(fetchFn, url, headers, body, timeoutMs);
    if (!(failure instanceof LlmFailure)) return failure;
    const retries = failure.reason === 'provider_unavailable' ? UNAVAILABLE_RETRIES
      : failure.reason === 'timeout' || failure.reason === 'network' ? TIMEOUT_RETRIES : 0;
    if (attempt >= retries) throw failure;
    await sleep(backoff(attempt, retryDelayMs));
  }
}

/** One call: the parsed body, or the failure (a body that is not JSON is thrown: retrying will not fix it). */
async function attemptPost(
  fetchFn: FetchLike,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
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
    const text = await response.text().catch(() => '');
    return new LlmFailure(statusReason(response.status, text));
  } catch (error) {
    if (error instanceof LlmFailure) throw error;
    return new LlmFailure(controller.signal.aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
}

/** The reason of a provider status (401/403 key, 404 model, 429 quota, 5xx or "overloaded" saturated). */
function statusReason(status: number, body: string): LlmFailureReason {
  if (UNAVAILABLE_STATUSES.has(status) || /overloaded/i.test(body)) return 'provider_unavailable';
  if (status === 401 || status === 403) return 'provider_auth';
  if (status === 404) return 'provider_model';
  return status === 429 ? 'provider_rate_limit' : 'http_error';
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

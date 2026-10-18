/**
 * Provider-neutral contract of the LLM gateway. Nothing here knows about
 * Luma: copy the whole `_shared/llm` folder to reuse it in another project.
 */

/** One request: fixed instructions, untrusted data, and the JSON wanted back. */
export interface LlmRequest {
  /** Instructions (trusted, written by the server). */
  readonly system: string;
  /** Data for the model (may contain untrusted text, e.g. business names). */
  readonly user: string;
  /** JSON Schema of the answer; providers that support it constrain the output. */
  readonly schema: Readonly<Record<string, unknown>>;
  /** Output cap; small answers need little. */
  readonly maxTokens?: number;
}

/** Why a call failed (for logs and tests only; callers answer ai_unavailable). */
export type LlmFailureReason =
  | 'timeout'
  | 'network'
  | 'http_error'
  | 'refused'
  | 'invalid_json'
  | 'invalid_shape';

export type LlmResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: 'ai_unavailable'; readonly reason: LlmFailureReason };

/**
 * Turns the parsed JSON into a typed value, or null when it does not match.
 * Callers pass a strict validator (shape + ids from the candidate set).
 */
export type LlmValidator<T> = (value: unknown) => T | null;

export interface LlmProvider {
  readonly name: string;
  generateJson<T>(request: LlmRequest, validate: LlmValidator<T>): Promise<LlmResult<T>>;
}

/** Injectable fetch, so tests never reach the network. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface ProviderOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl?: string;
  readonly fetch?: FetchLike;
  /** Per attempt; default 10 s. */
  readonly timeoutMs?: number;
}

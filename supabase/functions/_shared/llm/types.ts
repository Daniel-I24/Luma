/**
 * Provider-neutral contract of the LLM gateway. Nothing here knows about
 * Luma: copy the whole `_shared/llm` folder to reuse it in another project.
 */

export type LlmImageType = 'image/jpeg' | 'image/png' | 'image/webp';

/** An image for multimodal models (base64, already checked by the caller). */
export interface LlmImage {
  readonly mimeType: LlmImageType;
  readonly base64: string;
}

/** One request: fixed instructions, untrusted data, and the JSON wanted back. */
export interface LlmRequest {
  /** Instructions (trusted, written by the server). */
  readonly system: string;
  /** Data for the model (may contain untrusted text, e.g. business names). */
  readonly user: string;
  /** JSON Schema of the answer; providers that support it constrain the output. */
  readonly schema: Readonly<Record<string, unknown>>;
  /** Untrusted images that go with the data (e.g. photos of a menu). */
  readonly images?: readonly LlmImage[];
  /** Output cap; small answers need little. */
  readonly maxTokens?: number;
}

/**
 * Why a call failed. Callers answer ai_unavailable; extract-menu also says
 * the reason (never a key or a provider message) so the owner gets a useful
 * message: provider_auth (key refused, 401/403), provider_model (model
 * unknown, 404), provider_rate_limit (429), http_error (other statuses).
 */
export type LlmFailureReason =
  | 'timeout'
  | 'network'
  | 'http_error'
  | 'provider_auth'
  | 'provider_model'
  | 'provider_rate_limit'
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

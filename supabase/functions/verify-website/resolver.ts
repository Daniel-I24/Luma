import { CLOUDFLARE_DOH_URL } from '../_shared/config/provider-urls.ts';
import type { FetchLike, Resolver } from './ssrf.ts';

type RecordType = 'A' | 'AAAA';
/** Deno.resolveDns, when the runtime has it. */
export type NativeDns = (host: string, type: RecordType) => Promise<string[]>;

const DOH_TIMEOUT_MS = 3_000;
/** DNS record type numbers in a DoH JSON answer. */
const TYPE_NUMBER: Readonly<Record<RecordType, number>> = { A: 1, AAAA: 28 };
const LOOKS_LIKE: Readonly<Record<RecordType, RegExp>> = { A: /^\d{1,3}(\.\d{1,3}){3}$/, AAAA: /^[0-9a-f:.]+$/i };
const TYPES: readonly RecordType[] = ['A', 'AAAA'];

/** One record type through DNS over HTTPS; nothing on any failure (the host is then refused). */
async function dohLookup(host: string, type: RecordType, fetchFn: FetchLike): Promise<string[]> {
  try {
    const url = `${CLOUDFLARE_DOH_URL}?name=${encodeURIComponent(host)}&type=${type}`;
    const res = await fetchFn(url, { method: 'GET', headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(DOH_TIMEOUT_MS) });
    if (!res.ok) {
      await res.body?.cancel();
      return [];
    }
    const body = (await res.json()) as { Status?: unknown; Answer?: { type?: unknown; data?: unknown }[] };
    if (body.Status !== 0 || !Array.isArray(body.Answer)) return [];
    return body.Answer
      .filter((a) => a.type === TYPE_NUMBER[type] && typeof a.data === 'string' && LOOKS_LIKE[type].test(a.data))
      .map((a) => a.data as string);
  } catch {
    return [];
  }
}

/** A and AAAA records through Cloudflare's DNS over HTTPS (JSON), 3 s each. */
export function dohResolver(fetchFn: FetchLike): Resolver {
  return async (host) => (await Promise.all(TYPES.map((type) => dohLookup(host, type, fetchFn)))).flat();
}

/**
 * The resolver of the function: Deno.resolveDns when it exists; when it is
 * missing or not supported by the runtime (any error but "not found"),
 * DNS over HTTPS. A host without records resolves to nothing and is refused.
 */
export function runtimeResolver(native: NativeDns | undefined, fetchFn: FetchLike): Resolver {
  if (!native) return dohResolver(fetchFn);
  return async (host) => {
    const lists = await Promise.all(
      TYPES.map((type) =>
        native(host, type).catch((error: unknown) =>
          error instanceof Error && error.name === 'NotFound' ? [] : dohLookup(host, type, fetchFn)
        ),
      ),
    );
    return lists.flat();
  };
}

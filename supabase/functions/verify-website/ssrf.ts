import { isBlockedAddress, isIpv4Literal } from './ip-address.ts';

/** Resolves a host name to its addresses (resolver.ts in production, a fake in tests). */
export type Resolver = (host: string) => Promise<string[]>;
/** fetch without following redirects (redirect: 'manual'). */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type FetchOutcome =
  | { readonly kind: 'ok'; readonly text: string }
  | { readonly kind: 'blocked' | 'not_found' | 'too_large' | 'unreachable' };

const FILE_PATH = '/.well-known/luma-verification.txt';
const TIMEOUT_MS = 5_000;
export const MAX_BYTES = 4_096;
const MAX_REDIRECTS = 2;
/** The https URL of the verification file of a website, or null (http, other port, credentials, IP or odd host). */
export function verificationUrl(website: string): URL | null {
  let url: URL;
  try {
    url = new URL(website);
  } catch {
    return null;
  }
  const host = url.hostname;
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password) return null;
  if (!host.includes('.') || isIpv4Literal(host) || host.startsWith('[') || host === 'localhost' || host.endsWith('.local')) return null;
  return new URL(FILE_PATH, url.origin);
}

async function hostIsPublic(host: string, resolve: Resolver): Promise<boolean> {
  const addresses = await resolve(host).catch(() => [] as string[]);
  return addresses.length > 0 && addresses.every((ip) => !isBlockedAddress(ip));
}

async function readLimited(res: Response): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(all);
}

/**
 * Downloads the verification file with the SSRF rules: https on 443 only,
 * every host resolved and refused when any address is private, loopback,
 * link-local or metadata (again after each redirection), at most 2
 * redirections and only within the same host, 5 s in all, 4 KB at most, no
 * cookies and no header of the user. Residual risk (docs/whatsapp-setup.md,
 * "verify-website"): DNS rebinding between our resolution and the fetch.
 */
export async function fetchVerificationFile(start: URL, resolve: Resolver, fetchFn: FetchLike): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let url = start;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.hostname !== start.hostname) return { kind: 'blocked' };
      if (!(await hostIsPublic(url.hostname, resolve))) return { kind: 'blocked' };
      const res = await fetchFn(url.href, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: 'text/plain', 'User-Agent': 'LumaVerifier/1.0' },
      });
      if (res.status >= 300 && res.status < 400) {
        await res.body?.cancel();
        const location = res.headers.get('location');
        if (!location) return { kind: 'unreachable' };
        url = new URL(location, url);
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel();
        return { kind: 'not_found' };
      }
      const text = await readLimited(res);
      return text === null ? { kind: 'too_large' } : { kind: 'ok', text };
    }
    return { kind: 'blocked' };
  } catch {
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

/** The file proves the site when one of its lines is exactly the code. */
export function containsCode(text: string, code: string): boolean {
  return text.split(/\r?\n/).some((line) => line.trim() === code);
}

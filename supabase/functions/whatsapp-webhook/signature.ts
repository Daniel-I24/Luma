import { SecureCompare } from '../_shared/secure-compare.ts';

const encoder = new TextEncoder();
const PREFIX = 'sha256=';
const HEX_SIGNATURE = /^sha256=[0-9a-f]{64}$/;

async function hmacHex(secret: string, data: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
  return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Same length strings compared without stopping at the first difference. */
export function constantTimeEqual(a: string, b: string): boolean {
  return SecureCompare.equal(a, b);
}

/**
 * X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(App Secret, raw body) in hex
 * (Meta, "Webhooks: Event Notifications"). Checked on the raw bytes BEFORE
 * anything is parsed; a missing or malformed header is a failure.
 */
export async function validSignature(secret: string, rawBody: Uint8Array<ArrayBuffer>, header: string | null): Promise<boolean> {
  const value = header?.trim().toLowerCase() ?? '';
  if (!HEX_SIGNATURE.test(value)) return false;
  return constantTimeEqual(value.slice(PREFIX.length), await hmacHex(secret, rawBody));
}

/** A salted hash of the sender for the attempt limits: the number itself is never stored. */
export function senderHash(secret: string, sender: string): Promise<string> {
  return hmacHex(secret, encoder.encode(`luma-sender:${sender}`));
}

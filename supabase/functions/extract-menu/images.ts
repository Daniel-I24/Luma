import type { LlmImage, LlmImageType } from '../_shared/llm/types.ts';

/** Whole request (JSON with base64 images); checked by Content-Length first. */
export const MAX_BODY_BYTES = 8 * 1024 * 1024;
/** Per decoded image, the same as the business-images bucket. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGES = 4;

const UUID = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
/** Longest base64 text of one image (4 characters per 3 bytes). */
const MAX_ENCODED_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;

export interface ExtractInput {
  readonly businessId: string;
  readonly images: readonly LlmImage[];
}

/** The real type of the bytes, whatever the client claims. */
export function sniffImage(bytes: Uint8Array): LlmImageType | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function decode(base64: string): Uint8Array | null {
  // 4 base64 characters per 3 bytes: refuse before decoding anything big.
  if (base64.length > MAX_ENCODED_LENGTH || !BASE64.test(base64)) return null;
  try {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The request before any image is decoded: ids and base64 strings only. */
export interface ExtractEnvelope {
  readonly businessId: string;
  readonly encodedImages: readonly string[];
}

/**
 * { business_id, images: [base64, ...] }: checks only the shape (uuid, 1 to
 * 4 strings no longer than one image may be). Cheap, so it runs before the
 * session, ownership and rate limit; decoding comes after them.
 */
export function parseEnvelope(body: unknown): ExtractEnvelope | null {
  if (typeof body !== 'object' || body === null) return null;
  const { business_id: businessId, images } = body as Record<string, unknown>;
  if (typeof businessId !== 'string' || !UUID.test(businessId)) return null;
  if (!Array.isArray(images) || images.length < 1 || images.length > MAX_IMAGES) return null;
  if (!images.every((image) => typeof image === 'string' && image.length <= MAX_ENCODED_LENGTH)) return null;
  return { businessId: businessId.toLowerCase(), encodedImages: images as string[] };
}

/** Decodes each image and checks its magic bytes (JPEG, PNG or WebP, 2 MB each). Null otherwise. */
export function decodeImages(encoded: readonly string[]): LlmImage[] | null {
  const checked: LlmImage[] = [];
  for (const image of encoded) {
    const bytes = decode(image);
    const mimeType = bytes && bytes.byteLength <= MAX_IMAGE_BYTES ? sniffImage(bytes) : null;
    if (!mimeType) return null;
    checked.push({ mimeType, base64: image });
  }
  return checked;
}

/** Both steps at once, for callers that need no checks in between. */
export function parseInput(body: unknown): ExtractInput | null {
  const envelope = parseEnvelope(body);
  const images = envelope ? decodeImages(envelope.encodedImages) : null;
  return envelope && images ? { businessId: envelope.businessId, images } : null;
}

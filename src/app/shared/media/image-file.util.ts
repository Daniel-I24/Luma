/** Types the business-images bucket accepts (allowed_mime_types). */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Largest picture the app agrees to decode (phones take 4-12 MB photos). */
export const MAX_INPUT_BYTES = 15 * 1024 * 1024;
/** Bucket limit (file_size_limit): what is actually uploaded. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
/** Longest side after resizing. */
export const MAX_IMAGE_SIDE = 1280;

/** Translation key when a picked file cannot be used, or null. */
export function checkImageFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return 'media.errors.type';
  if (file.size > MAX_INPUT_BYTES) return 'media.errors.size';
  return null;
}

/** Size that fits within `max` keeping the aspect ratio; never enlarges. */
export function fitWithin(
  width: number,
  height: number,
  max = MAX_IMAGE_SIDE,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

const PUBLIC_PATH = /\/storage\/v1\/object\/public\/business-images\/([^?#]+)$/;

/** Object path of a public business-images URL, or null for any other URL. */
export function imagePathFromUrl(url: string | null | undefined): string | null {
  const match = url ? PUBLIC_PATH.exec(url) : null;
  return match ? decodeURIComponent(match[1]) : null;
}

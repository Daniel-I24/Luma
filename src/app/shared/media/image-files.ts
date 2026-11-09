/** Types the business-images bucket accepts (allowed_mime_types). */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/**
 * What the system picker offers for a photo. "image/*" opens the photo picker of every Android
 * (no storage permission: the picker grants that one file) and Safari hands HEIC over as JPEG.
 */
export const PHOTO_PICKER_ACCEPT = 'image/*';
/**
 * Sent by phones but never uploaded as is: the picture is decoded and re-encoded first. Some
 * Android galleries give no type at all; HEIC depends on the phone, and the decoder decides.
 */
const DECODER_DECIDES = ['', 'image/heic', 'image/heif'];
/** Largest picture the app agrees to decode (phones take 4-12 MB photos). */
const MAX_INPUT_BYTES = 15_728_640; // 15 MB
/** Bucket limit (file_size_limit): what is actually uploaded. */
export const MAX_UPLOAD_BYTES = 2_097_152; // 2 MB
/** Longest side after resizing. */
export const MAX_IMAGE_SIDE = 1280;

/** ImageFiles — checks, fits and locates image files. */
export class ImageFiles {
  /** Translation key when a picked file cannot be used, or null. */
  public static checkImageFile(file: Pick<File, 'type' | 'size'>): string | null {
    if (![...ACCEPTED_IMAGE_TYPES, ...DECODER_DECIDES].includes(file.type)) return 'media.errors.type';
    if (file.size > MAX_INPUT_BYTES) return 'media.errors.size';
    return null;
  }

  /** Size that fits within `max` keeping the aspect ratio; never enlarges. */
  public static fitWithin(
    width: number,
    height: number,
    max = MAX_IMAGE_SIDE,
  ): { width: number; height: number } {
    const scale = Math.min(1, max / Math.max(width, height));
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
  }

  /** Object path of a public business-images URL, or null for any other URL. */
  public static imagePathFromUrl(url: string | null | undefined): string | null {
    const match = url ? PUBLIC_PATH.exec(url) : null;
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }
}


const PUBLIC_PATH = /\/storage\/v1\/object\/public\/business-images\/([^?#]+)$/;

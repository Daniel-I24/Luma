import { MAX_IMAGE_SIDE, MAX_UPLOAD_BYTES, fitWithin } from './image-file.util';

export interface EncodedImage {
  readonly blob: Blob;
  readonly contentType: 'image/webp' | 'image/jpeg';
  readonly extension: 'webp' | 'jpg';
}

/** A picture that could not be decoded or brought under the upload limit. */
export class ImageEncodeError extends Error {
  constructor(readonly errorKey: string) {
    super(errorKey);
  }
}

const FORMATS = [
  { contentType: 'image/webp', extension: 'webp' },
  { contentType: 'image/jpeg', extension: 'jpg' },
] as const;
const QUALITIES = [0.82, 0.65, 0.5];

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Decodes the picture (applying its EXIF orientation), scales it down to
 * MAX_IMAGE_SIDE and encodes it again as WebP, or JPEG where the browser
 * cannot write WebP. Drawing on a canvas keeps only the pixels, so every
 * metadata block (EXIF, including the GPS position) is dropped.
 */
export async function reencodeImage(file: Blob, maxSide = MAX_IMAGE_SIDE): Promise<EncodedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageEncodeError('media.errors.decode');
  }
  const size = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new ImageEncodeError('media.errors.decode');
  }
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();

  for (const format of FORMATS) {
    for (const quality of QUALITIES) {
      const blob = await toBlob(canvas, format.contentType, quality);
      // Browsers fall back to PNG for types they cannot write.
      if (!blob || blob.type !== format.contentType) break;
      if (blob.size <= MAX_UPLOAD_BYTES) return { blob, ...format };
    }
  }
  throw new ImageEncodeError('media.errors.size');
}

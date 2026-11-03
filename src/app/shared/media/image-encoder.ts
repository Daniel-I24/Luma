import { InjectionToken } from '@angular/core';
import { MAX_IMAGE_SIDE, MAX_UPLOAD_BYTES, ImageFiles } from './image-files';
import { HALF } from '@core/config/units';

export interface EncodedImage {
  readonly blob: Blob;
  readonly contentType: 'image/webp' | 'image/jpeg';
  readonly extension: 'webp' | 'jpg';
}

/** A picture that could not be decoded or brought under the upload limit. */
export class ImageEncodeError extends Error {
  constructor(public readonly errorKey: string) {
    super(errorKey);
  }
}

const FORMATS = [
  { contentType: 'image/webp', extension: 'webp' },
  { contentType: 'image/jpeg', extension: 'jpg' },
] as const;
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- data table: encoder qualities, best first
const QUALITIES = [0.82, 0.65, 0.5];

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** ImageReencoder — re-encodes an image to strip metadata and bound its size. */
export class ImageReencoder {
  /**
   * Decodes the picture (applying its EXIF orientation), optionally keeps its
   * centred square, scales it down to MAX_IMAGE_SIDE and encodes it again as WebP, or JPEG where the browser
   * cannot write WebP. Drawing on a canvas keeps only the pixels, so every
   * metadata block (EXIF, including the GPS position) is dropped.
   */
  public static async reencodeImage(
    file: Blob,
    maxSide = MAX_IMAGE_SIDE,
    options: { readonly square?: boolean } = {},
  ): Promise<EncodedImage> {
    const bitmap = await ImageReencoder.decode(file);
    try {
      return await ImageReencoder.encode(ImageReencoder.draw(bitmap, maxSide, options.square === true));
    } finally {
      bitmap.close();
    }
  }

  private static async decode(file: Blob): Promise<ImageBitmap> {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      throw new ImageEncodeError('media.errors.decode');
    }
  }

  /** The picture (or its centred square, for profile photos) scaled into a canvas. */
  private static draw(bitmap: ImageBitmap, maxSide: number, square: boolean): HTMLCanvasElement {
    const crop = square ? Math.min(bitmap.width, bitmap.height) : null;
    const source = crop
      ? { x: (bitmap.width - crop) * HALF, y: (bitmap.height - crop) * HALF, width: crop, height: crop }
      : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
    const size = ImageFiles.fitWithin(source.width, source.height, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new ImageEncodeError('media.errors.decode');
    context.drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, size.width, size.height);
    return canvas;
  }

  /** WebP (or JPEG) at the first quality that fits the upload limit. */
  private static async encode(canvas: HTMLCanvasElement): Promise<EncodedImage> {
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
}

/** The encoder, injectable so tests without a canvas can replace it. */
export const IMAGE_ENCODER = new InjectionToken<typeof ImageReencoder.reencodeImage>('IMAGE_ENCODER', {
  providedIn: 'root',
  factory: () => ImageReencoder.reencodeImage,
});

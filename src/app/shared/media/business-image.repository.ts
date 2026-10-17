import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '@shared/business/data/business.repository';
import { ImageEncodeError, reencodeImage } from './image-encoder';
import { checkImageFile, imagePathFromUrl } from './image-file.util';

export const BUSINESS_IMAGES_BUCKET = 'business-images';
export type BusinessImageKind = 'logo' | 'cover' | 'menu' | 'promotions';

/** One year: object names are unique, so a stored picture never changes. */
const CACHE_SECONDS = '31536000';

/**
 * BusinessImageRepository — uploads business pictures to Storage at
 * {business_id}/{kind}/{uuid}.{ext} (the only paths the bucket policies
 * accept, and only for the owner) after validating and re-encoding them.
 */
@Injectable({ providedIn: 'root' })
export class BusinessImageRepository {
  private readonly storage = inject(SupabaseService).client.storage;

  /** Uploads a picture; resolves to its public https URL. */
  async upload(
    businessId: string,
    kind: BusinessImageKind,
    file: File,
  ): Promise<RepoResult<string>> {
    const invalid = checkImageFile(file);
    if (invalid) return { data: null, errorKey: invalid };
    let encoded;
    try {
      encoded = await reencodeImage(file);
    } catch (error) {
      const key = error instanceof ImageEncodeError ? error.errorKey : 'media.errors.decode';
      return { data: null, errorKey: key };
    }
    const path = `${businessId}/${kind}/${crypto.randomUUID()}.${encoded.extension}`;
    const bucket = this.storage.from(BUSINESS_IMAGES_BUCKET);
    const { error } = await bucket.upload(path, encoded.blob, {
      contentType: encoded.contentType,
      cacheControl: CACHE_SECONDS,
      upsert: false,
    });
    if (error) return { data: null, errorKey: 'media.errors.uploadFailed' };
    return { data: bucket.getPublicUrl(path).data.publicUrl, errorKey: null };
  }

  /**
   * Deletes a picture this app uploaded (other URLs are left alone). Used
   * once the new URL is saved, so the old file does not linger.
   */
  async remove(url: string | null | undefined): Promise<RepoResult<true>> {
    const path = imagePathFromUrl(url);
    if (!path) return { data: true, errorKey: null };
    const { error } = await this.storage.from(BUSINESS_IMAGES_BUCKET).remove([path]);
    if (error) return { data: null, errorKey: 'media.errors.deleteFailed' };
    return { data: true, errorKey: null };
  }
}

import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '@shared/business/data/business.repository';
import { type EncodedImage, IMAGE_ENCODER, ImageEncodeError } from '@shared/media/image-encoder';
import { ImageFiles } from '@shared/media/image-files';

const HTTP_FORBIDDEN = 403;

/**
 * AvatarRepository — the optional profile photo in the private avatars
 * bucket. The picture is cropped to a square and re-encoded first (no EXIF,
 * no GPS position), then recorded with the user's consent (set_avatar). A
 * business sees it only through a short signed URL while serving the user.
 */
@Injectable({ providedIn: 'root' })
export class AvatarRepository {
  private static readonly BUCKET = 'avatars';
  private static readonly SIDE = 512;
  private static readonly SIGNED_URL_SECONDS = 60;

  private readonly db = inject(SupabaseService).client;
  private readonly encode = inject(IMAGE_ENCODER);

  /** Replaces the user's photo; the old object is removed first (one per user). */
  public async upload(userId: string, file: File, consent: boolean): Promise<RepoResult<string>> {
    if (!consent) return { data: null, errorKey: 'avatar.errors.consent' };
    const invalid = ImageFiles.checkImageFile(file);
    if (invalid) return { data: null, errorKey: invalid };
    let encoded: EncodedImage;
    try {
      encoded = await this.encode(file, AvatarRepository.SIDE, { square: true });
    } catch (error) {
      return { data: null, errorKey: error instanceof ImageEncodeError ? error.errorKey : 'media.errors.decode' };
    }
    if (!(await this.removeObjects(userId))) return { data: null, errorKey: 'avatar.errors.upload' };
    const path = `${userId}/avatar/${crypto.randomUUID()}.${encoded.extension}`;
    const bucket = this.db.storage.from(AvatarRepository.BUCKET);
    const uploaded = await bucket.upload(path, encoded.blob, { contentType: encoded.contentType, upsert: false });
    if (uploaded.error) return { data: null, errorKey: AvatarRepository.uploadErrorKey(uploaded.error) };
    const { error } = await this.db.rpc('set_avatar', { p_path: path, p_consent: true });
    if (error) {
      await bucket.remove([path]);
      return { data: null, errorKey: 'avatar.errors.upload' };
    }
    return { data: path, errorKey: null };
  }

  /** Removes the photo and turns sharing off. */
  public async clear(userId: string): Promise<RepoResult<true>> {
    const { error } = await this.db.rpc('set_avatar', { p_path: null, p_consent: null });
    if (error || !(await this.removeObjects(userId))) return { data: null, errorKey: 'avatar.errors.remove' };
    return { data: true, errorKey: null };
  }

  /** Short-lived URL; Storage refuses it unless the policy allows the caller. */
  public async signedUrl(path: string): Promise<string | null> {
    const { data, error } = await this.db.storage
      .from(AvatarRepository.BUCKET)
      .createSignedUrl(path, AvatarRepository.SIGNED_URL_SECONDS);
    return error || !data ? null : data.signedUrl;
  }

  /** What the user can do about a refused upload. */
  private static uploadErrorKey(error: { readonly name?: string; readonly status?: unknown; readonly statusCode?: unknown }): string {
    // Storage answers an RLS refusal as HTTP 400 with statusCode "403".
    if (Number(error.status) === HTTP_FORBIDDEN || Number(error.statusCode) === HTTP_FORBIDDEN) return 'avatar.errors.denied';
    return error.name === 'StorageUnknownError' ? 'avatar.errors.network' : 'avatar.errors.upload';
  }

  private async removeObjects(userId: string): Promise<boolean> {
    const bucket = this.db.storage.from(AvatarRepository.BUCKET);
    const folder = `${userId}/avatar`;
    const listed = await bucket.list(folder);
    if (listed.error) return false;
    if (!listed.data.length) return true;
    const { error } = await bucket.remove(listed.data.map((object) => `${folder}/${object.name}`));
    return !error;
  }
}

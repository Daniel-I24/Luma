import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { BusinessImageRepository } from '@shared/media/business-image.repository';
import type { RepoResult } from './business.repository';
import { BusinessWriteErrors } from './business-write-error';

/** Same bound as business_photos.sort_order in the database. */
const MAX_GALLERY_ORDER = 99;

/** Gallery of a business (business_photos): at most 8, public when the business is. */
export const MAX_PHOTOS = 8;
export const MAX_CAPTION = 60;

export interface BusinessPhoto {
  readonly id: string;
  readonly path: string;
  readonly url: string;
  readonly caption: string | null;
  readonly sortOrder: number;
}

interface PhotoRow {
  id: string;
  storage_path: string;
  caption: string | null;
  sort_order: number;
}

/**
 * BusinessPhotoRepository — the photos of the place. RLS lets anyone read
 * those of public businesses and only the owner write them; a trigger caps
 * them at 8. Files live at {business}/gallery/{uuid}.{ext}.
 */
@Injectable({ providedIn: 'root' })
export class BusinessPhotoRepository {
  private readonly db = inject(SupabaseService).client;
  private readonly images = inject(BusinessImageRepository);

  /** Photos of a business gallery, in order. */
  public async list(businessId: string): Promise<RepoResult<BusinessPhoto[]>> {
    const { data, error } = await this.db
      .from('business_photos')
      .select('id, storage_path, caption, sort_order')
      .eq('business_id', businessId)
      .order('sort_order')
      .order('created_at');
    if (error) return { data: null, errorKey: 'businessPanel.gallery.loadFailed' };
    return { data: (data as PhotoRow[]).map((row) => this.toPhoto(row)), errorKey: null };
  }

  /** Uploads the file, then records it; the file is removed if the row is refused. */
  public async add(businessId: string, file: File, sortOrder: number): Promise<RepoResult<BusinessPhoto>> {
    const stored = await this.images.store(businessId, 'gallery', file);
    if (!stored.data) return { data: null, errorKey: stored.errorKey };
    const { data, error } = await this.db
      .from('business_photos')
      .insert({ business_id: businessId, storage_path: stored.data.path, sort_order: Math.min(sortOrder, MAX_GALLERY_ORDER) })
      .select('id, storage_path, caption, sort_order')
      .single();
    if (error) {
      await this.images.removePath(stored.data.path);
      return { data: null, errorKey: BusinessWriteErrors.mapWriteError(error, 'businessPanel.errors.saveFailed') };
    }
    return { data: this.toPhoto(data as PhotoRow), errorKey: null };
  }

  /** Changes the caption or order of a photo. */
  public async update(id: string, changes: { caption?: string | null; sortOrder?: number }): Promise<RepoResult<true>> {
    const caption = changes.caption === undefined ? undefined : changes.caption?.trim().slice(0, MAX_CAPTION) || null;
    const { error } = await this.db
      .from('business_photos')
      .update({ caption, sort_order: changes.sortOrder })
      .eq('id', id);
    if (error) return { data: null, errorKey: BusinessWriteErrors.mapWriteError(error, 'businessPanel.errors.saveFailed') };
    return { data: true, errorKey: null };
  }

  /** Deletes the row, then its file. */
  public async remove(photo: BusinessPhoto): Promise<RepoResult<true>> {
    const { error } = await this.db.from('business_photos').delete().eq('id', photo.id);
    if (error) return { data: null, errorKey: BusinessWriteErrors.mapWriteError(error, 'businessPanel.errors.saveFailed') };
    await this.images.removePath(photo.path);
    return { data: true, errorKey: null };
  }

  private toPhoto(row: PhotoRow): BusinessPhoto {
    return {
      id: row.id,
      path: row.storage_path,
      url: this.images.publicUrl(row.storage_path),
      caption: row.caption,
      sortOrder: row.sort_order,
    };
  }
}

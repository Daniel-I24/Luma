import { Injectable, computed, inject, signal } from '@angular/core';
import {
  type BusinessPhoto,
  BusinessPhotoRepository,
  MAX_PHOTOS,
} from '@shared/business/data/business-photo.repository';

/** GalleryStore — the photos of one business in Luma Negocios. */
@Injectable()
export class GalleryStore {
  private readonly repo = inject(BusinessPhotoRepository);

  private readonly _photos = signal<readonly BusinessPhoto[]>([]);
  private readonly _loading = signal(true);
  private readonly _busy = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  private businessId = '';

  public readonly photos = this._photos.asReadonly();
  public readonly loading = this._loading.asReadonly();
  public readonly busy = this._busy.asReadonly();
  public readonly errorKey = this._errorKey.asReadonly();
  public readonly free = computed(() => MAX_PHOTOS - this._photos().length);

  /** Loads the gallery of a business. */
  public async load(businessId: string): Promise<void> {
    this.businessId = businessId;
    this._loading.set(true);
    const result = await this.repo.list(businessId);
    this._photos.set(result.data ?? []);
    this._errorKey.set(result.errorKey);
    this._loading.set(false);
  }

  /** Adds the chosen files in order, as many as still fit. */
  public async add(files: readonly File[]): Promise<void> {
    const room = this.free();
    await this.run(async () => {
      for (const file of files.slice(0, room)) {
        const result = await this.repo.add(this.businessId, file, this.nextOrder());
        if (!result.data) return result.errorKey;
        const photo = result.data;
        this._photos.update((photos) => [...photos, photo]);
      }
      return files.length > room ? 'businessPanel.errors.galleryLimit' : null;
    });
  }

  /** Saves a photo caption. */
  public async caption(photo: BusinessPhoto, caption: string): Promise<void> {
    if ((photo.caption ?? '') === caption.trim()) return;
    await this.run(async () => {
      const result = await this.repo.update(photo.id, { caption });
      if (result.errorKey) return result.errorKey;
      this.replace({ ...photo, caption: caption.trim() || null });
      return null;
    });
  }

  /** Swaps a photo with its neighbour (direction -1: earlier, 1: later). */
  public async move(photo: BusinessPhoto, direction: -1 | 1): Promise<void> {
    const photos = [...this._photos()];
    const from = photos.findIndex((p) => p.id === photo.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= photos.length) return;
    [photos[from], photos[to]] = [photos[to], photos[from]];
    const ordered = photos.map((p, index) => ({ ...p, sortOrder: index }));
    await this.run(async () => {
      for (const p of [ordered[from], ordered[to]]) {
        const result = await this.repo.update(p.id, { sortOrder: p.sortOrder });
        if (result.errorKey) return result.errorKey;
      }
      this._photos.set(ordered);
      return null;
    });
  }

  /** Deletes a photo from the gallery and Storage. */
  public async remove(photo: BusinessPhoto): Promise<void> {
    await this.run(async () => {
      const result = await this.repo.remove(photo);
      if (result.errorKey) return result.errorKey;
      this._photos.update((photos) => photos.filter((p) => p.id !== photo.id));
      return null;
    });
  }

  private nextOrder(): number {
    return this._photos().reduce((max, p) => Math.max(max, p.sortOrder + 1), 0);
  }

  private replace(photo: BusinessPhoto): void {
    this._photos.update((photos) => photos.map((p) => (p.id === photo.id ? photo : p)));
  }

  /** One change at a time; the error of the last one is kept to show it. */
  private async run(operation: () => Promise<string | null>): Promise<void> {
    if (this._busy()) return;
    this._busy.set(true);
    this._errorKey.set(null);
    try {
      this._errorKey.set(await operation());
    } catch {
      this._errorKey.set('businessPanel.errors.saveFailed');
    } finally {
      this._busy.set(false);
    }
  }
}

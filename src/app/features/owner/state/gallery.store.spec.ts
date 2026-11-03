import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import {
  type BusinessPhoto,
  BusinessPhotoRepository,
} from '@shared/business/data/business-photo.repository';
import { BusinessImageRepository } from '@shared/media/business-image.repository';
import { GalleryStore } from './gallery.store';

const photo = (n: number): BusinessPhoto => ({ id: `p${n}`, path: `b/gallery/${n}.webp`, url: `https://x/${n}`, caption: null, sortOrder: n });
const file = () => new File(['x'], 'a.jpg', { type: 'image/jpeg' });

describe('GalleryStore', () => {
  const repo = { list: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn() };
  let store: GalleryStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [GalleryStore, { provide: BusinessPhotoRepository, useValue: repo }] });
    store = TestBed.inject(GalleryStore);
    repo.list.mockResolvedValue({ data: [photo(0), photo(1)], errorKey: null });
    await store.load('b');
  });

  it('adds only as many files as fit in the 8 and says why the rest did not', async () => {
    repo.list.mockResolvedValue({ data: [0, 1, 2, 3, 4, 5, 6].map(photo), errorKey: null });
    await store.load('b');
    repo.add.mockResolvedValue({ data: photo(7), errorKey: null });
    await store.add([file(), file(), file()]);
    expect(repo.add).toHaveBeenCalledTimes(1);
    expect(repo.add).toHaveBeenCalledWith('b', expect.any(File), 7);
    expect([store.photos().length, store.free(), store.errorKey()]).toEqual([8, 0, 'businessPanel.errors.galleryLimit']);
  });

  it('moves a photo by swapping sort orders with its neighbour', async () => {
    repo.update.mockResolvedValue({ data: true, errorKey: null });
    await store.move(photo(1), -1);
    expect(store.photos().map((p) => [p.id, p.sortOrder])).toEqual([['p1', 0], ['p0', 1]]);
    await store.move(store.photos()[0], -1);
    expect(repo.update).toHaveBeenCalledTimes(2);
  });

  it('keeps the list when the server refuses and shows the error', async () => {
    repo.remove.mockResolvedValue({ data: null, errorKey: 'businessPanel.errors.forbidden' });
    await store.remove(photo(0));
    expect([store.photos().length, store.errorKey()]).toEqual([2, 'businessPanel.errors.forbidden']);
  });

  it('skips unchanged captions and trims new ones', async () => {
    repo.update.mockResolvedValue({ data: true, errorKey: null });
    await store.caption(photo(0), '  ');
    expect(repo.update).not.toHaveBeenCalled();
    await store.caption(photo(0), ' Terraza ');
    expect(store.photos()[0].caption).toBe('Terraza');
  });
});

describe('BusinessPhotoRepository', () => {
  it('removes the uploaded file when the row is refused (e.g. gallery_limit)', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'gallery_limit' } });
    const db = { from: () => ({ insert: () => ({ select: () => ({ single }) }) }) };
    const images = {
      store: vi.fn().mockResolvedValue({ data: { path: 'b/gallery/x.webp', url: 'https://x' }, errorKey: null }),
      removePath: vi.fn().mockResolvedValue({ data: true, errorKey: null }),
      publicUrl: vi.fn(),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: db } },
        { provide: BusinessImageRepository, useValue: images },
      ],
    });
    const result = await TestBed.inject(BusinessPhotoRepository).add('b', file(), 0);
    expect(result).toEqual({ data: null, errorKey: 'businessPanel.errors.galleryLimit' });
    expect(images.removePath).toHaveBeenCalledWith('b/gallery/x.webp');
  });
});

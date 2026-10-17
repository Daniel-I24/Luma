import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { BusinessImageRepository } from './business-image.repository';
import { ImageEncodeError, reencodeImage } from './image-encoder';
import { checkImageFile, fitWithin, imagePathFromUrl } from './image-file.util';

const PUBLIC = 'https://x.supabase.co/storage/v1/object/public/business-images/';

describe('image file checks', () => {
  it('accepts JPEG, PNG and WebP up to 15 MB', () => {
    expect(checkImageFile({ type: 'image/webp', size: 1000 })).toBeNull();
    expect(checkImageFile({ type: 'image/gif', size: 1000 })).toBe('media.errors.type');
    expect(checkImageFile({ type: 'image/svg+xml', size: 10 })).toBe('media.errors.type');
    expect(checkImageFile({ type: 'image/jpeg', size: 16 * 1024 * 1024 })).toBe(
      'media.errors.size',
    );
  });

  it('scales down to the longest side without enlarging', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(1000, 3000)).toEqual({ width: 427, height: 1280 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('reads the object path only from business-images public URLs', () => {
    expect(imagePathFromUrl(`${PUBLIC}b1/logo/f.webp`)).toBe('b1/logo/f.webp');
    expect(imagePathFromUrl('https://cdn.example.com/b1/logo/f.webp')).toBeNull();
    expect(imagePathFromUrl(null)).toBeNull();
  });
});

describe('reencodeImage', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubCanvas(blobs: (Blob | null)[]) {
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((callback) => callback(blobs.shift() ?? null));
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 4000, height: 3000, close }),
    );
    return { drawImage, toBlob, close };
  }

  it('draws the picture at most 1280 px wide and encodes it as WebP', async () => {
    const { drawImage, toBlob, close } = stubCanvas([new Blob(['x'], { type: 'image/webp' })]);

    const encoded = await reencodeImage(new Blob(['raw'], { type: 'image/jpeg' }));

    expect(encoded).toEqual(
      expect.objectContaining({ contentType: 'image/webp', extension: 'webp' }),
    );
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1280, 960);
    expect(toBlob.mock.calls[0][1]).toBe('image/webp');
    expect(close).toHaveBeenCalled();
    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(Blob), {
      imageOrientation: 'from-image',
    });
  });

  it('falls back to JPEG when the browser cannot write WebP', async () => {
    stubCanvas([new Blob(['x'], { type: 'image/png' }), new Blob(['y'], { type: 'image/jpeg' })]);

    expect((await reencodeImage(new Blob())).extension).toBe('jpg');
  });

  it('lowers the quality until it fits in 2 MB, then gives up', async () => {
    const big = () => new Blob([new Uint8Array(3 * 1024 * 1024)], { type: 'image/webp' });
    stubCanvas([big(), big(), big(), big(), big(), big()]);

    await expect(reencodeImage(new Blob())).rejects.toEqual(
      new ImageEncodeError('media.errors.size'),
    );
  });

  it('reports pictures that cannot be decoded', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bad')));

    await expect(reencodeImage(new Blob())).rejects.toEqual(
      new ImageEncodeError('media.errors.decode'),
    );
  });
});

describe('BusinessImageRepository', () => {
  function setup(uploadError: unknown = null) {
    const bucket = {
      upload: vi.fn().mockResolvedValue({ error: uploadError }),
      remove: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: `${PUBLIC}${path}` } }),
    };
    const from = vi.fn(() => bucket);
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { storage: { from } } } }],
    });
    return { repo: TestBed.inject(BusinessImageRepository), bucket, from };
  }

  it('rejects unsupported files before touching Storage', async () => {
    const { repo, bucket } = setup();

    const result = await repo.upload('b1', 'logo', new File(['x'], 'a.gif', { type: 'image/gif' }));

    expect(result).toEqual({ data: null, errorKey: 'media.errors.type' });
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  it('removes only pictures of its own bucket', async () => {
    const { repo, bucket, from } = setup();

    await repo.remove('https://cdn.example.com/a.webp');
    await repo.remove(`${PUBLIC}b1/logo/f.webp`);

    expect(from).toHaveBeenCalledWith('business-images');
    expect(bucket.remove).toHaveBeenCalledOnce();
    expect(bucket.remove).toHaveBeenCalledWith(['b1/logo/f.webp']);
  });
});

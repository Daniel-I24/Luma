import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { IMAGE_ENCODER } from '@shared/media/image-encoder';
import { AvatarRepository } from './avatar.repository';

describe('AvatarRepository', () => {
  const bucket = {
    list: vi.fn(),
    remove: vi.fn().mockResolvedValue({ error: null }),
    upload: vi.fn().mockResolvedValue({ error: null }),
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null }),
  };
  const rpc = vi.fn();
  const encode = vi.fn().mockResolvedValue({ blob: new Blob(['x']), contentType: 'image/webp', extension: 'webp' });
  const photo = new File(['x'], 'me.jpg', { type: 'image/jpeg' });

  beforeEach(() => {
    vi.clearAllMocks();
    bucket.list.mockResolvedValue({ data: [{ name: 'old.webp' }], error: null });
    rpc.mockResolvedValue({ data: null, error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { rpc, storage: { from: () => bucket } } } },
        { provide: IMAGE_ENCODER, useValue: encode },
      ],
    });
  });

  it('crops and re-encodes, replaces the old photo and records the consent', async () => {
    const result = await TestBed.inject(AvatarRepository).upload('u1', photo, true);
    expect(encode).toHaveBeenCalledWith(photo, 512, { square: true });
    expect(bucket.remove).toHaveBeenCalledWith(['u1/avatar/old.webp']);
    expect(result.data).toMatch(/^u1\/avatar\/[0-9a-f-]{36}\.webp$/);
    expect(rpc).toHaveBeenCalledWith('set_avatar', { p_path: result.data, p_consent: true });
  });

  it('never uploads without consent or a valid picture', async () => {
    const repo = TestBed.inject(AvatarRepository);
    expect((await repo.upload('u1', photo, false)).errorKey).toBe('avatar.errors.consent');
    expect((await repo.upload('u1', new File(['x'], 'a.gif', { type: 'image/gif' }), true)).errorKey).toBe('media.errors.type');
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  it('removes the uploaded file when the server refuses it', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'avatar_not_found' } });
    const result = await TestBed.inject(AvatarRepository).upload('u1', photo, true);
    expect(result.errorKey).toBe('avatar.errors.upload');
    expect(bucket.remove).toHaveBeenLastCalledWith([expect.stringMatching(/^u1\/avatar\//)]);
  });

  it('says what the user can do when Storage refuses the upload', async () => {
    const repo = TestBed.inject(AvatarRepository);
    bucket.upload.mockResolvedValueOnce({ error: { name: 'StorageApiError', status: 400, statusCode: '403' } });
    expect((await repo.upload('u1', photo, true)).errorKey).toBe('avatar.errors.denied');
    bucket.upload.mockResolvedValueOnce({ error: { name: 'StorageUnknownError' } });
    expect((await repo.upload('u1', photo, true)).errorKey).toBe('avatar.errors.network');
    bucket.upload.mockResolvedValueOnce({ error: { name: 'StorageApiError', status: 500 } });
    expect((await repo.upload('u1', photo, true)).errorKey).toBe('avatar.errors.upload');
    expect(rpc).not.toHaveBeenCalledWith('set_avatar', expect.objectContaining({ p_consent: true }));
  });

  it('clearing turns sharing off and deletes the files; signed URLs live 60 s', async () => {
    const repo = TestBed.inject(AvatarRepository);
    expect((await repo.clear('u1')).data).toBe(true);
    expect(rpc).toHaveBeenCalledWith('set_avatar', { p_path: null, p_consent: null });
    expect(await repo.signedUrl('u1/avatar/x.webp')).toBe('https://signed');
    expect(bucket.createSignedUrl).toHaveBeenCalledWith('u1/avatar/x.webp', 60);
  });
});

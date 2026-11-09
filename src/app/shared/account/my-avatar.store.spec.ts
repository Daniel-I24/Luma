import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarRepository } from './avatar.repository';
import { MyAvatarStore } from './my-avatar.store';
import { SessionProfileStore } from './session-profile.store';

describe('MyAvatarStore', () => {
  const profile = signal<{ avatarPath: string | null } | null>(null);
  const signedUrl = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionProfileStore, useValue: { profile, whenLoaded: () => Promise.resolve() } },
        { provide: AvatarRepository, useValue: { signedUrl } },
      ],
    });
  });

  it('gives the signed URL of the photo in the profile', async () => {
    profile.set({ avatarPath: 'u1/avatar/a.webp' });
    signedUrl.mockResolvedValue('https://signed');
    const store = TestBed.inject(MyAvatarStore);
    await store.refresh();
    expect(signedUrl).toHaveBeenCalledWith('u1/avatar/a.webp');
    expect(store.url()).toBe('https://signed');
    expect(store.failed()).toBe(false);
  });

  it('has no URL and no failure without a photo', async () => {
    profile.set({ avatarPath: null });
    const store = TestBed.inject(MyAvatarStore);
    await store.refresh();
    expect(store.url()).toBeNull();
    expect(store.failed()).toBe(false);
    expect(signedUrl).not.toHaveBeenCalled();
  });

  it('says so when the photo exists but cannot be fetched', async () => {
    profile.set({ avatarPath: 'u1/avatar/a.webp' });
    signedUrl.mockResolvedValue(null);
    const store = TestBed.inject(MyAvatarStore);
    await store.refresh();
    expect(store.url()).toBeNull();
    expect(store.failed()).toBe(true);
  });
});

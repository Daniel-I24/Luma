import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { UserDataRegistry } from '@core/auth/user-data-registry';
import { ToastService } from '@design-system/toast/toast.service';
import { FavoriteRepository } from '@shared/business/data/favorite.repository';
import { FavoritesStore } from './favorites.store';

const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('FavoritesStore', () => {
  const user = signal<{ id: string } | null>({ id: 'u1' });
  const repo = { getFavoriteIds: vi.fn(), add: vi.fn(), remove: vi.fn() };
  const toasts = { show: vi.fn() };
  let store: FavoritesStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    user.set({ id: 'u1' });
    repo.getFavoriteIds.mockResolvedValue({ data: ['b1'], errorKey: null });
    repo.add.mockResolvedValue({ data: true, errorKey: null });
    repo.remove.mockResolvedValue({ data: true, errorKey: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user } },
        { provide: FavoriteRepository, useValue: repo },
        { provide: ToastService, useValue: toasts },
      ],
    });
    store = TestBed.inject(FavoritesStore);
    TestBed.flushEffects();
    await flush();
  });

  it('loads the favourites once for the signed-in user', () => {
    expect(store.isFavorite('b1')).toBe(true);
    expect(repo.getFavoriteIds).toHaveBeenCalledOnce();
  });

  it('adds optimistically, before the request finishes', async () => {
    let resolve!: (value: unknown) => void;
    repo.add.mockReturnValue(new Promise((r) => (resolve = r)));

    const pending = store.toggle('b2');
    expect(store.isFavorite('b2')).toBe(true);

    resolve({ data: true, errorKey: null });
    expect(await pending).toBe(true);
    expect(store.isFavorite('b2')).toBe(true);
    expect(toasts.show).toHaveBeenCalledWith({ messageKey: 'favorites.added', tone: 'success' });
  });

  it('reverts and reports the error when saving fails', async () => {
    repo.remove.mockResolvedValue({ data: null, errorKey: 'businesses.errors.favoriteSaveFailed' });

    const result = await store.toggle('b1');

    expect(result).toBe(false);
    expect(store.isFavorite('b1')).toBe(true);
    expect(toasts.show).toHaveBeenCalledWith({
      messageKey: 'businesses.errors.favoriteSaveFailed',
      tone: 'error',
    });
  });

  it('ignores repeated taps while a change is in flight', async () => {
    const first = store.toggle('b2');
    await store.toggle('b2');
    await first;

    expect(repo.add).toHaveBeenCalledOnce();
    expect(store.isFavorite('b2')).toBe(true);
  });

  it('is wiped through the user data registry (sign-out or account deletion)', () => {
    TestBed.inject(UserDataRegistry).clearAll();

    expect(store.ids().size).toBe(0);
  });

  it('drops a toggle response that arrives after the user data was wiped', async () => {
    let resolve!: (value: unknown) => void;
    repo.remove.mockReturnValue(new Promise((r) => (resolve = r)));
    const pending = store.toggle('b1');

    store.clearUserData();
    resolve({ data: null, errorKey: 'businesses.errors.favoriteSaveFailed' });

    expect(await pending).toBe(false);
    expect(store.isFavorite('b1')).toBe(false);
    expect(toasts.show).not.toHaveBeenCalled();
  });

  it('clears the favourites on sign-out and reloads for the next user', async () => {
    user.set(null);
    TestBed.flushEffects();
    await flush();
    expect(store.ids().size).toBe(0);

    repo.getFavoriteIds.mockResolvedValue({ data: ['b9'], errorKey: null });
    user.set({ id: 'u2' });
    TestBed.flushEffects();
    await flush();
    expect(store.isFavorite('b9')).toBe(true);
    expect(store.isFavorite('b1')).toBe(false);
  });

  it('reports when the favourites are known, or failed, and reloads them on demand', async () => {
    expect(store.ready()).toBe(true);
    expect(store.failed()).toBe(false);

    repo.getFavoriteIds.mockResolvedValue({
      data: null,
      errorKey: 'businesses.errors.favoritesFailed',
    });
    await store.reload();
    expect(store.failed()).toBe(true);

    repo.getFavoriteIds.mockResolvedValue({ data: ['b7'], errorKey: null });
    await store.reload();
    expect(store.failed()).toBe(false);
    expect(store.isFavorite('b7')).toBe(true);
  });
});

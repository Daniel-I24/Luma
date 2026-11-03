import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { ACCOUNT_ERROR_PATH } from './account-homes';
import { accountHomeGuard, accountReadyGuard, ownerGuard } from './account.guards';
import { AccountProfileRepository } from './account-profile.repository';
import { AccountType } from './account-type';
import { PROFILE_RETRY_DELAYS_MS, SessionProfileStore } from './session-profile.store';

describe('an unreadable profile is never a customer', () => {
  const repo = { getMine: vi.fn(), becomeBusinessOwner: vi.fn() };
  const failure = { data: null, errorKey: 'profile.errors.load' };
  const owner = {
    data: {
      accountType: AccountType.parse('business_owner'),
      displayName: null,
      fullName: null,
      phone: null,
    },
    errorKey: null,
  };
  const run = (guard: typeof ownerGuard) =>
    TestBed.runInInjectionContext(() => guard({} as never, {} as never)) as Promise<UrlTree | true>;
  const path = (tree: UrlTree | true) => (tree === true ? true : TestBed.inject(Router).serializeUrl(tree));

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('luma.welcome.v1', 'seen');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: signal({ id: 'u1' }), ready: Promise.resolve() } },
        { provide: AccountProfileRepository, useValue: repo },
      ],
    });
  });

  it('home, landing and the guards point to the error screen', async () => {
    repo.getMine.mockResolvedValue(failure);
    const store = TestBed.inject(SessionProfileStore);
    await store.whenLoaded();
    expect(store.failed()).toBe(true);
    expect(store.accountType()).toBeNull();
    expect(await store.homePath()).toBe(ACCOUNT_ERROR_PATH);
    expect(await store.landingPath()).toBe(ACCOUNT_ERROR_PATH);
    expect(path(await run(accountReadyGuard))).toBe(ACCOUNT_ERROR_PATH);
    expect(path(await run(ownerGuard))).toBe(ACCOUNT_ERROR_PATH);
    expect(path(await run(accountHomeGuard))).toBe(ACCOUNT_ERROR_PATH);
  });

  it('retry reads it again and clears the error', async () => {
    repo.getMine.mockResolvedValueOnce(failure).mockResolvedValue(owner);
    const store = TestBed.inject(SessionProfileStore);
    await store.whenLoaded();
    expect(await store.retry()).toBe(true);
    expect(store.failed()).toBe(false);
    expect(await store.homePath()).toBe('/owner');
    expect(await run(accountReadyGuard)).toBe(true);
  });

  it('right after signing in reads the new user profile, never the "nobody" state (the race behind A3)', async () => {
    const user = signal<{ id: string } | null>(null);
    TestBed.overrideProvider(AuthService, { useValue: { user, ready: Promise.resolve() } });
    repo.getMine.mockResolvedValue(owner);
    const store = TestBed.inject(SessionProfileStore);
    await store.whenLoaded();
    // The session arrives; the guard asks before the reload effect has run.
    user.set({ id: 'u1' });

    expect(await store.homePath()).toBe('/owner');
    expect(repo.getMine).toHaveBeenCalledWith('u1');
  });

  it('retries a failed read twice, silently, before showing the error', async () => {
    vi.useFakeTimers();
    repo.getMine.mockResolvedValueOnce(failure).mockResolvedValueOnce(failure).mockResolvedValue(owner);
    const store = TestBed.inject(SessionProfileStore);
    const loaded = store.whenLoaded();
    await vi.advanceTimersByTimeAsync(PROFILE_RETRY_DELAYS_MS[0] + PROFILE_RETRY_DELAYS_MS[1]);
    await loaded;
    vi.useRealTimers();

    expect(repo.getMine).toHaveBeenCalledTimes(3);
    expect(store.failed()).toBe(false);
  });

  it('shows the error only after the third failed read; an outdated database is not retried', async () => {
    vi.useFakeTimers();
    repo.getMine.mockResolvedValue(failure);
    const store = TestBed.inject(SessionProfileStore);
    const loaded = store.whenLoaded();
    await vi.advanceTimersByTimeAsync(2000);
    await loaded;
    expect(repo.getMine).toHaveBeenCalledTimes(3);
    expect(store.failed()).toBe(true);

    repo.getMine.mockClear().mockResolvedValue({ data: null, errorKey: 'accountError.outdated' });
    const retried = store.retry();
    await vi.advanceTimersByTimeAsync(2000);
    await retried;
    vi.useRealTimers();
    expect(repo.getMine).toHaveBeenCalledTimes(1);
  });
});

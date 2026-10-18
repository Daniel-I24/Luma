import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { accountHomeGuard, ownerGuard } from './account.guards';
import { AccountProfileRepository } from './account-profile.repository';
import { AccountType } from './account-type';
import { ONBOARDING_VERSION } from './onboarding';
import { Phone } from './phone';
import { SessionProfileStore } from './session-profile.store';

describe('AccountType', () => {
  it('parses known types and treats anything else as a customer', () => {
    expect(AccountType.parse('business_owner').isBusinessOwner).toBe(true);
    expect(AccountType.parse('customer').isBusinessOwner).toBe(false);
    expect(AccountType.parse('admin').equals(AccountType.customer)).toBe(true);
    expect(AccountType.parse(null).value).toBe('customer');
  });
});

describe('Phone', () => {
  it('normalises Colombian mobiles to E.164 like the database', () => {
    expect(Phone.parse('+57 300 123 4567')?.e164).toBe('+573001234567');
    expect(Phone.parse('300-123-4567')?.e164).toBe('+573001234567');
    expect(Phone.parse('573001234567')?.display).toBe('+57 300 123 4567');
  });

  it('rejects landlines, short numbers and other countries', () => {
    expect(Phone.parse('6012345678')).toBeNull();
    expect(Phone.parse('30012345')).toBeNull();
    expect(Phone.parse('+1 300 123 4567')).toBeNull();
    expect(Phone.parse('')).toBeNull();
  });
});

describe('SessionProfileStore and guards', () => {
  const user = signal<{ id: string } | null>({ id: 'u1' });
  const repo = { getMine: vi.fn(), becomeBusinessOwner: vi.fn(), setOnboardingSeen: vi.fn() };
  const profile = (type: string, seen = ONBOARDING_VERSION) => ({
    data: {
      accountType: AccountType.parse(type),
      displayName: null,
      fullName: null,
      phone: null,
      onboardingSeenVersion: seen,
    },
    errorKey: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    user.set({ id: 'u1' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user, ready: Promise.resolve() } },
        { provide: AccountProfileRepository, useValue: repo },
      ],
    });
  });

  const run = (guard: typeof ownerGuard) =>
    TestBed.runInInjectionContext(() => guard({} as never, {} as never)) as Promise<
      boolean | UrlTree
    >;

  it('exposes the account type and lands customers on the map', async () => {
    repo.getMine.mockResolvedValue(profile('customer'));
    const store = TestBed.inject(SessionProfileStore);
    TestBed.tick();

    expect(await store.homePath()).toBe('/map');
    expect(store.isBusinessOwner()).toBe(false);
    const redirect = await run(ownerGuard);
    expect(TestBed.inject(Router).serializeUrl(redirect as UrlTree)).toBe('/map');
  });

  it('lets business owners into the panel and lands them there', async () => {
    repo.getMine.mockResolvedValue(profile('business_owner'));
    TestBed.inject(SessionProfileStore);
    TestBed.tick();

    expect(await run(ownerGuard)).toBe(true);
    const home = await run(accountHomeGuard);
    expect(TestBed.inject(Router).serializeUrl(home as UrlTree)).toBe('/business');
  });

  it('upgrades a customer once and reloads the profile', async () => {
    repo.getMine
      .mockResolvedValueOnce(profile('customer'))
      .mockResolvedValue(profile('business_owner'));
    repo.becomeBusinessOwner.mockResolvedValue({ data: AccountType.businessOwner, errorKey: null });
    const store = TestBed.inject(SessionProfileStore);
    TestBed.tick();
    await store.whenLoaded();

    expect(await store.becomeBusinessOwner()).toBe(true);
    expect(store.accountType()?.value).toBe('business_owner');
  });

  it('clears the profile when the user signs out', async () => {
    repo.getMine.mockResolvedValue(profile('business_owner'));
    const store = TestBed.inject(SessionProfileStore);
    TestBed.tick();
    await store.whenLoaded();

    user.set(null);
    TestBed.tick();
    await store.whenLoaded();
    expect(store.profile()).toBeNull();
  });
});

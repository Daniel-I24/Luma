import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { accountHomeGuard } from './account.guards';
import { AccountProfileRepository } from './account-profile.repository';
import { AccountType } from './account-type';
import { ONBOARDING_PATH, ONBOARDING_VERSION } from './onboarding';
import { SessionProfileStore } from './session-profile.store';

describe('Onboarding landing', () => {
  const repo = { getMine: vi.fn(), becomeBusinessOwner: vi.fn(), setOnboardingSeen: vi.fn() };
  const profile = (seen: number) => ({
    data: {
      accountType: AccountType.customer,
      displayName: null,
      fullName: null,
      phone: null,
      onboardingSeenVersion: seen,
    },
    errorKey: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { user: signal({ id: 'u1' }), ready: Promise.resolve() },
        },
        { provide: AccountProfileRepository, useValue: repo },
      ],
    });
  });

  const land = async () => {
    const tree = (await TestBed.runInInjectionContext(() =>
      accountHomeGuard({} as never, {} as never),
    )) as UrlTree;
    return TestBed.inject(Router).serializeUrl(tree);
  };

  it('shows the tutorial to accounts that have not seen this version', async () => {
    repo.getMine.mockResolvedValue(profile(ONBOARDING_VERSION - 1));
    TestBed.inject(SessionProfileStore);
    TestBed.tick();

    expect(await land()).toBe(ONBOARDING_PATH);
  });

  it('goes straight home once this version was seen', async () => {
    repo.getMine.mockResolvedValue(profile(ONBOARDING_VERSION));
    TestBed.inject(SessionProfileStore);
    TestBed.tick();

    expect(await land()).toBe('/map');
  });

  it('records the version and stops showing it', async () => {
    repo.getMine.mockResolvedValue(profile(0));
    repo.setOnboardingSeen.mockResolvedValue({ data: true, errorKey: null });
    const store = TestBed.inject(SessionProfileStore);
    TestBed.tick();
    await store.whenLoaded();

    expect(await store.markOnboardingSeen()).toBe(true);
    expect(repo.setOnboardingSeen).toHaveBeenCalledWith('u1', ONBOARDING_VERSION);
    expect(await store.landingPath()).toBe('/map');
  });

  it('reports a failed save so the tutorial can still close', async () => {
    repo.getMine.mockResolvedValue(profile(0));
    repo.setOnboardingSeen.mockResolvedValue({ data: null, errorKey: 'x' });
    const store = TestBed.inject(SessionProfileStore);
    TestBed.tick();
    await store.whenLoaded();

    expect(await store.markOnboardingSeen()).toBe(false);
  });
});

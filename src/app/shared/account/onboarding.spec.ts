import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { accountHomeGuard } from './account.guards';
import { AccountProfileRepository } from './account-profile.repository';
import { AccountType } from './account-type';
import { ONBOARDING_PATH, WelcomeTutorial } from './onboarding';
import { SessionProfileStore } from './session-profile.store';

describe('Onboarding landing', () => {
  const repo = { getMine: vi.fn(), becomeBusinessOwner: vi.fn() };
  const profile = () => ({
    data: {
      accountType: AccountType.customer,
      displayName: null,
      fullName: null,
      phone: null,
    },
    errorKey: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

  it('shows the tutorial the first time the app opens on this device', async () => {
    repo.getMine.mockResolvedValue(profile());
    TestBed.inject(SessionProfileStore);
    TestBed.tick();

    expect(await land()).toBe(ONBOARDING_PATH);
  });

  it('never again at the next sign-in on the same device', async () => {
    repo.getMine.mockResolvedValue(profile());
    TestBed.inject(WelcomeTutorial).markSeen();
    TestBed.inject(SessionProfileStore);
    TestBed.tick();

    expect(await land()).toBe('/map');
    expect(localStorage.getItem('luma.welcome.v1')).not.toBeNull();
  });

  it('is remembered by the device, not by the account', () => {
    TestBed.inject(WelcomeTutorial).markSeen();
    TestBed.resetTestingModule();

    expect(TestBed.inject(WelcomeTutorial).needed()).toBe(false);
  });

  it('without storage it is shown at most once per app start', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const welcome = TestBed.inject(WelcomeTutorial);
    expect(welcome.needed()).toBe(true);
    welcome.markSeen();
    expect(welcome.needed()).toBe(false);
    vi.restoreAllMocks();
  });
});

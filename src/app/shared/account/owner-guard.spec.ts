import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { routes } from '../../app.routes';
import { ownerChildGuard, ownerGuard } from './account.guards';
import { OWNER_INVITE_PATH } from './account-type';
import { AccountProfileRepository } from './account-profile.repository';
import { AccountType } from './account-type';

@Component({ template: '' })
class Blank {}

const profile = (type: string) => ({
  data: { accountType: AccountType.parse(type), displayName: null, fullName: null, phone: null },
  errorKey: null,
});

describe('Luma Negocios guard (/owner)', () => {
  const user = signal<{ id: string } | null>({ id: 'owner-1' });
  const repo = { getMine: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('luma.welcome.v1', 'seen');
    user.set({ id: 'owner-1' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'owner',
            canActivate: [ownerGuard],
            canActivateChild: [ownerChildGuard],
            children: [{ path: ':id', component: Blank }],
          },
          { path: 'profile', component: Blank },
          { path: 'map', component: Blank },
        ]),
        { provide: AuthService, useValue: { user, ready: Promise.resolve() } },
        { provide: AccountProfileRepository, useValue: repo },
      ],
    });
  });

  it('a customer who opens /owner is sent to the invitation to register a business', async () => {
    repo.getMine.mockResolvedValue(profile('customer'));
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/owner/b-1');
    expect(router.url).toBe(OWNER_INVITE_PATH);
  });

  it('a customer signing in on a device left inside the panel cannot move to another business of it', async () => {
    repo.getMine.mockImplementation((id: string) => Promise.resolve(profile(id === 'owner-1' ? 'business_owner' : 'customer')));
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/owner/b-1');
    expect(router.url).toBe('/owner/b-1');

    user.set({ id: 'customer-2' });
    await router.navigateByUrl('/owner/b-2');
    expect(router.url).toBe(OWNER_INVITE_PATH);
  });

  it('the app routes guard /owner and every child route with the account type', () => {
    const owner = routes.find((route) => route.path === 'owner');
    expect(owner?.canActivateChild).toEqual([ownerChildGuard]);
  });
});

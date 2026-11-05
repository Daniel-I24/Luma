import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorLog } from '@core/errors/error-log';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { LandingNavigation } from '@shared/account/landing-navigation';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { createFakeSupabase, failure, ok } from '../fake-supabase';

@Component({ template: '' })
class Screen {}

/** What can go wrong right after a good sign-in, with the real services. */
describe('journey: right after signing in', () => {
  const online = signal(true);

  function setup(responses: Parameters<typeof createFakeSupabase>[0]): void {
    online.set(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'map', loadComponent: () => Promise.reject(new Error('Loading chunk map failed')) },
          { path: 'account-error', component: Screen },
        ]),
        { provide: SupabaseService, useValue: { client: createFakeSupabase(responses).client } },
        { provide: ConnectivityService, useValue: { online } },
        { provide: SessionProfileStore, useValue: { landingPath: vi.fn().mockResolvedValue('/map') } },
      ],
    });
  }

  beforeEach(() => vi.clearAllMocks());

  it('the map screen does not download: the account error screen, not an unhandled error', async () => {
    setup({});
    await expect(TestBed.inject(LandingNavigation).goHome()).resolves.toBe(true);
    expect(TestBed.inject(Router).url).toBe('/account-error');
    expect(TestBed.inject(ErrorLog).entries()[0]).toMatchObject({ source: 'auth' });
  });

  it('the first read of the map tells a lost connection from a failed service and from bad data', async () => {
    setup({ businesses: failure('TypeError: Failed to fetch') });
    const repo = TestBed.inject(BusinessRepository);
    expect((await repo.getNearby(1.2, -77.3, 5)).errorKey).toBe('businesses.errors.network');

    online.set(false);
    TestBed.resetTestingModule();
    setup({ businesses: { data: null, error: { code: '500', message: 'server' } } });
    online.set(false);
    expect((await TestBed.inject(BusinessRepository).getNearby(1.2, -77.3, 5)).errorKey).toBe('businesses.errors.network');

    TestBed.resetTestingModule();
    setup({ businesses: { data: null, error: { code: 'PGRST301', message: 'JWT expired' } } });
    expect((await TestBed.inject(BusinessRepository).getNearby(1.2, -77.3, 5)).errorKey).toBe('businesses.errors.service');

    TestBed.resetTestingModule();
    setup({ businesses: ok({ not: 'a list' }) });
    expect((await TestBed.inject(BusinessRepository).getNearby(1.2, -77.3, 5)).errorKey).toBe('businesses.errors.badData');

    TestBed.resetTestingModule();
    setup({ businesses: ok([]) });
    expect(await TestBed.inject(BusinessRepository).getNearby(1.2, -77.3, 5)).toEqual({ data: [], errorKey: null });
  });
});

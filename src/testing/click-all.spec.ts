import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { ConnectivityService } from '@core/network/connectivity.service';
import { PushRegistration } from '@core/push/push-registration.service';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { NotificationPreferencesRepository } from '@shared/notifications/notification-preferences.repository';
import { NotificationSettings } from '@shared/notifications/notification-settings/notification-settings';
import { AccountErrorPage } from '../app/features/account-error/account-error.page';
import { PlaceResults } from '../app/features/map/components/place-results/place-results';
import { CollectingErrorHandler, clickAll, provideCollectingErrorHandler } from './click-all';

@Component({
  selector: 'app-broken',
  standalone: true,
  template: `<button type="button" (click)="ok()">Bien</button><button type="button" (click)="boom()">Roto</button>`,
})
class Broken {
  ok(): void {
    // Works.
  }
  boom(): void {
    throw new Error('dead button');
  }
}

describe('clickAll', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      // Errors go to the collecting handler instead of failing the run.
      rethrowApplicationErrors: false,
      imports: [TranslocoTestingModule.forRoot({ langs: { es: {} } })],
      providers: [
        // Any address resolves, so following a navigation never throws.
        provideRouter([{ path: '**', component: Broken }]),
        ...provideCollectingErrorHandler(),
        { provide: AuthService, useValue: { signOut: vi.fn().mockResolvedValue({ success: true }) } },
        { provide: ConnectivityService, useValue: { online: signal(true) } },
        { provide: SessionProfileStore, useValue: { retry: vi.fn().mockResolvedValue(false), landingPath: vi.fn() } },
        { provide: PushRegistration, useValue: { permission: signal('prompt'), enable: vi.fn().mockResolvedValue('granted') } },
        {
          provide: NotificationPreferencesRepository,
          useValue: {
            get: vi.fn().mockResolvedValue({ data: { orders: true, promotions: false }, errorKey: null }),
            set: vi.fn().mockResolvedValue({ data: true, errorKey: null }),
          },
        },
      ],
    });
  });

  const report = async (component: unknown, inputs: Record<string, unknown> = {}) => {
    const fixture = TestBed.createComponent(component as typeof Broken);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    await fixture.whenStable();
    return clickAll(fixture, TestBed.inject(CollectingErrorHandler));
  };

  it('reports a button whose handler throws', async () => {
    const result = await report(Broken);
    expect(result.clicked).toEqual(['Bien', 'Roto']);
    expect(result.errors).toHaveLength(1);
  });

  it('every control of the account error screen works', async () => {
    const result = await report(AccountErrorPage);
    expect(result.clicked.length).toBe(2);
    expect(result.errors).toEqual([]);
  });

  it('every control of the notification settings works', async () => {
    const result = await report(NotificationSettings);
    expect(result.clicked.length).toBe(3);
    expect(result.errors).toEqual([]);
  });

  it('every control of the place results works', async () => {
    const place = { label: 'Centro, Pasto', kind: 'neighbourhood', lat: 1.21, lng: -77.28 };
    const result = await report(PlaceResults, { places: [place] });
    expect(result.clicked.length).toBe(2);
    expect(result.errors).toEqual([]);
  });
});

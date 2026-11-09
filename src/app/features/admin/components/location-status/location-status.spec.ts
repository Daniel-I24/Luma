import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import { GeolocationService, type LocationAttempt } from '@shared/geo/geolocation.service';
import { LocationStatus } from './location-status';

describe('LocationStatus', () => {
  const lastAttempt = signal<LocationAttempt | null>(null);

  beforeEach(() => {
    lastAttempt.set(null);
    TestBed.configureTestingModule({
      imports: [LocationStatus, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [{ provide: GeolocationService, useValue: { lastAttempt, coords: signal({ lat: 1.23456, lng: -77.28111 }) } }],
    });
  });

  function text(): string {
    const fixture = TestBed.createComponent(LocationStatus);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('says so when nothing was attempted', () => {
    expect(text()).toContain('admin.technical.location.none');
  });

  it('shows the outcome, method, permission and accuracy, never the position', () => {
    lastAttempt.set({ outcome: 'ok', source: 'native', access: 'approximate', accuracyM: 1500, code: null, at: new Date('2026-11-09T15:00:00Z'), ms: 420 });
    const shown = text();
    expect(shown).toContain('admin.technical.location.outcome.ok');
    expect(shown).toContain('native');
    expect(shown).toContain('approximate');
    expect(shown).toContain('1500 m');
    expect(shown).toContain('10:00:00');
    expect(shown).not.toContain('1.23');
    expect(shown).not.toContain('77.28');
  });

  it('shows the code of a failure', () => {
    lastAttempt.set({ outcome: 'servicesOff', source: 'native', access: 'servicesOff', accuracyM: null, code: 'OS-PLUG-GLOC-0009', at: new Date(), ms: 1 });
    expect(text()).toContain('OS-PLUG-GLOC-0009');
  });
});

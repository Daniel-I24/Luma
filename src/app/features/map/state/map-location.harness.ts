import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AppEvents } from '@core/native/app-events';
import { SystemSettings } from '@core/native/system-settings';
import { type GeoState, GeolocationService, type LocationFailure } from '@shared/geo/geolocation.service';
import { MapCameraService } from '../services/map-camera.service';
import { MapLocation } from './map-location';
import { MapZone } from './map-zone';

export const state = signal<GeoState>('idle');
export const failure = signal<LocationFailure | null>(null);
export const resumes = signal(0);
export const stopFollowing = vi.fn();
export const geo = {
  state,
  failure,
  hasRealLocation: computed(() => state() === 'granted'),
  coords: signal({ lat: 1, lng: 2 }),
  requestLocation: vi.fn(),
  requestIfAllowed: vi.fn().mockResolvedValue(undefined),
  follow: vi.fn(() => stopFollowing),
  fallbackName: signal<string | null>(null),
};
export const camera = { flyTo: vi.fn(), centre: signal<{ lat: number; lng: number } | null>(null) };
export const zone = { browsing: signal(false), label: signal({ key: 'map.zone.at', params: { name: 'Granada' } }), follow: vi.fn(), recentre: vi.fn() };
export const settings = { available: true, openApp: vi.fn().mockResolvedValue(undefined), openLocation: vi.fn().mockResolvedValue(undefined) };

/** Fresh state and a module with the doubles. */
export function setUp(): void {
  vi.clearAllMocks();
  state.set('idle');
  failure.set(null);
  resumes.set(0);
  TestBed.configureTestingModule({
    providers: [
      MapLocation,
      { provide: GeolocationService, useValue: geo },
      { provide: MapCameraService, useValue: camera },
      { provide: MapZone, useValue: zone },
      { provide: SystemSettings, useValue: settings },
      { provide: AppEvents, useValue: { resumes } },
    ],
  });
}

export const flow = (): MapLocation => TestBed.inject(MapLocation);

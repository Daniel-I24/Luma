import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { LocationAccess, LocationReadOptions, LocationReading, LocationSource } from '@core/location/location-source';
import { LOCATION_SOURCE } from '@core/location/location-source.token';
import { GeolocationService } from './geolocation.service';

export const near = (accuracyM: number): LocationReading => ({ lat: 1.22, lng: -77.28, accuracyM });

export const read = vi.fn<(options: LocationReadOptions) => Promise<LocationReading>>();
export const request = vi.fn<() => Promise<LocationAccess>>();
export const access = vi.fn<() => Promise<LocationAccess>>();
export const stop = vi.fn();
export const watch = vi.fn<LocationSource['watch']>(() => stop);

/** Fresh mocks and a module with the simulated source. */
export function setUp(): void {
  vi.resetAllMocks();
  watch.mockReturnValue(stop);
  request.mockResolvedValue('granted');
  access.mockResolvedValue('prompt');
  const source: LocationSource = { kind: 'native', read, request, access, watch };
  TestBed.configureTestingModule({ providers: [{ provide: LOCATION_SOURCE, useValue: source }] });
}

export const service = (): GeolocationService => TestBed.inject(GeolocationService);

/** Lets the chain of promises of an attempt finish. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

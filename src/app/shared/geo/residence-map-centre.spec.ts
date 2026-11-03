import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { GeolocationService, PASTO_CENTRE } from './geolocation.service';
import { Residence } from './residence';
import { ResidenceCatalog } from './residence-catalog';
import { ResidenceMapCentre } from './residence-map-centre';

describe('ResidenceMapCentre', () => {
  function setup(residence: Residence | null) {
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionProfileStore, useValue: { whenLoaded: vi.fn().mockResolvedValue(undefined), profile: () => ({ residence }) } },
        { provide: ResidenceCatalog, useValue: { load: vi.fn().mockResolvedValue(true), municipality: () => ({ latitude: 3.45, longitude: -76.53 }) } },
      ],
    });
    return TestBed.inject(GeolocationService);
  }

  it('starts the map at the municipality of residence when there is no location', async () => {
    const geo = setup(Residence.of('Valle del Cauca', 'Cali', '76001'));
    await TestBed.inject(ResidenceMapCentre).apply();
    expect(geo.coords()).toEqual({ lat: 3.45, lng: -76.53 });
  });

  it('keeps Pasto without a residence', async () => {
    const geo = setup(null);
    await TestBed.inject(ResidenceMapCentre).apply();
    expect(geo.coords()).toEqual(PASTO_CENTRE);
  });
});

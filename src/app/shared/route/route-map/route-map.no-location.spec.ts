import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { BaseMap } from '@shared/map/map-base';
import { MapStylesLoader } from '@shared/map/map-styles.loader';
import { RouteRepository } from '../route.repository';
import { RouteMap } from './route-map';

const pins: number[][] = [];
vi.mock('maplibre-gl', () => ({
  Marker: class {
    public setLngLat(at: number[]) {
      pins.push(at);
      return this;
    }
    public addTo() {
      return this;
    }
  },
  LngLatBounds: class {},
  setWorkerUrl: () => undefined,
}));

describe('RouteMap without the customer location', () => {
  it('still shows the map with the business pin and offers "Activar ubicación"', async () => {
    const requestLocation = vi.fn();
    const created = vi.spyOn(BaseMap, 'createBaseMap').mockReturnValue({ remove: vi.fn() } as never);
    TestBed.configureTestingModule({
      imports: [RouteMap, TranslocoTestingModule.forRoot({ langs: { es: {} } })],
      providers: [
        { provide: GeolocationService, useValue: { hasRealLocation: signal(false), coords: signal({ lat: 0, lng: 0 }), requestLocation } },
        { provide: RouteRepository, useValue: { route: vi.fn() } },
        { provide: MapStylesLoader, useValue: { ensureLoaded: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(RouteMap);
    fixture.componentRef.setInput('lat', 1.22);
    fixture.componentRef.setInput('lng', -77.28);
    fixture.componentRef.setInput('name', 'Café');
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(created).toHaveBeenCalledWith(expect.any(HTMLElement), { lat: 1.22, lng: -77.28 }, expect.any(Number));
    expect(pins).toContainEqual([-77.28, 1.22]);
    const locate = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('route.locate'));
    locate?.click();
    expect(requestLocation).toHaveBeenCalled();
    expect(el.querySelector('a[href*="google"]')).not.toBeNull();
  });
});

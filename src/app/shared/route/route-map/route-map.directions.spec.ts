import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalMaps } from '@core/native/external-maps';
import { DeviceStorage } from '@core/storage/device-storage';
import { type GeoState, GeolocationService } from '@shared/geo/geolocation.service';
import { BaseMap } from '@shared/map/map-base';
import { MapStylesLoader } from '@shared/map/map-styles.loader';
import { RouteRepository, type TravelRoute } from '../route.repository';
import { RouteMap } from './route-map';

vi.mock('maplibre-gl', () => {
  class Chain {
    public setLngLat(): this { return this; }
    public addTo(): this { return this; }
    public extend(): this { return this; }
  }
  return { Map: class {}, Marker: Chain, LngLatBounds: Chain, setWorkerUrl: () => undefined };
});

const FROM = { lat: 1.2136, lng: -77.2811 };
const STREETS: TravelRoute = { line: [[-77.28, 1.21], [-77.27, 1.22]], distanceM: 900, durationS: 600, source: 'openrouteservice' };
const STRAIGHT: TravelRoute = { ...STREETS, source: 'straight' };

describe('RouteMap: "Cómo llegar"', () => {
  const route = vi.fn<(from: unknown, to: unknown, mode: unknown) => Promise<TravelRoute>>();
  const maps = { open: vi.fn(() => Promise.resolve()), navigate: vi.fn(() => Promise.resolve()) };
  const state = signal<GeoState>('granted');
  const coords = signal(FROM);
  const stopFollowing = vi.fn();
  const follow = vi.fn(() => stopFollowing);
  const requestLocation = vi.fn();
  const fitBounds = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    state.set('granted');
    coords.set(FROM);
    route.mockResolvedValue(STREETS);
    vi.spyOn(BaseMap, 'createBaseMap').mockReturnValue({
      once: (_event: string, handler: () => void) => handler(), getSource: () => undefined, addSource: vi.fn(), addLayer: vi.fn(),
      setPaintProperty: vi.fn(), fitBounds, remove: vi.fn(),
    } as never);
    TestBed.configureTestingModule({
      imports: [RouteMap, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [
        { provide: GeolocationService, useValue: {
          hasRealLocation: () => state() === 'granted', state, coords, requestLocation, follow,
          requestIfAllowed: () => Promise.resolve(),
        } },
        { provide: RouteRepository, useValue: { route } },
        { provide: MapStylesLoader, useValue: { ensureLoaded: vi.fn() } },
        { provide: ExternalMaps, useValue: maps },
        { provide: DeviceStorage, useValue: { read: () => null, write: vi.fn() } },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(RouteMap);
    fixture.componentRef.setInput('lat', 1.22);
    fixture.componentRef.setInput('lng', -77.28);
    fixture.componentRef.setInput('name', 'Café');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const press = async (key: string): Promise<void> => {
      [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(key))?.click();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, el, press };
  }

  it('with a route by streets, it frames it and stays in the app', async () => {
    const { press } = await render();
    fitBounds.mockClear();
    await press('route.directions');
    expect(fitBounds).toHaveBeenCalled();
    expect(maps.navigate).not.toHaveBeenCalled();
  });

  it('with only the straight line, it tries again: a route by streets stays in the app', async () => {
    route.mockResolvedValueOnce(STRAIGHT);
    const { press, el } = await render();
    expect(el.textContent).toContain('route.estimate');
    await press('route.directions');
    expect(route).toHaveBeenCalledTimes(2);
    expect(maps.navigate).not.toHaveBeenCalled();
    expect(el.textContent).not.toContain('route.estimate');
  });

  it('when it still fails, it opens the phone navigation with the destination', async () => {
    route.mockResolvedValue(STRAIGHT);
    const { press } = await render();
    await press('route.directions');
    expect(maps.navigate).toHaveBeenCalledWith(1.22, -77.28, 'Café');
  });

  it('without permission, it says why and opens the phone navigation', async () => {
    state.set('denied');
    const { press, el } = await render();
    expect(el.textContent).toContain('route.denied');
    await press('route.directions');
    expect(maps.navigate).toHaveBeenCalledWith(1.22, -77.28, 'Café');
    expect(route).not.toHaveBeenCalled();
  });

  it('without a location yet, it asks for it', async () => {
    state.set('idle');
    const { press } = await render();
    await press('route.locate');
    expect(requestLocation).toHaveBeenCalled();
    expect(maps.navigate).not.toHaveBeenCalled();
  });

  it('follows the customer while shown: a real move redraws, GPS noise does not', async () => {
    const { fixture } = await render();
    expect(follow).toHaveBeenCalledTimes(1);
    route.mockClear();
    coords.set({ lat: FROM.lat + 0.0001, lng: FROM.lng });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(route).not.toHaveBeenCalled();
    coords.set({ lat: FROM.lat + 0.002, lng: FROM.lng });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(route).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(stopFollowing).toHaveBeenCalled();
  });

  it('"Abrir en Google Maps" goes through the phone, with the travel mode in its address', async () => {
    const { el, fixture } = await render();
    const link = el.querySelector<HTMLAnchorElement>('a[href*="google"]');
    expect(link?.href).toContain('travelmode=walking');
    link?.click();
    await fixture.whenStable();
    expect(maps.open).toHaveBeenCalledWith(expect.stringContaining('destination=1.22%2C-77.28'));
  });
});

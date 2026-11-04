import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceStorage } from '@core/storage/device-storage';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { MapStylesLoader } from '@shared/map/map-styles.loader';
import { RouteRepository } from '../route.repository';
import { TravelModePreference } from '../travel-modes';
import { RouteMap } from './route-map';

// Isolated spec files (angular.json "isolate") keep this mock effective; drawing is not under test.
vi.mock('maplibre-gl', () => ({ Map: class {}, Marker: class {}, LngLatBounds: class {}, setWorkerUrl: () => undefined }));

const FROM = { lat: 1.2136, lng: -77.2811 };

describe('RouteMap travel modes', () => {
  const route = vi.fn();
  const stored = new Map<string, string>();

  beforeEach(() => {
    vi.clearAllMocks();
    stored.clear();
    route.mockImplementation((_from, _to, mode) =>
      Promise.resolve({ ...RouteRepository.straight(FROM, { lat: 1.22, lng: -77.28 }, mode), source: mode === 'moto' ? 'openrouteservice' : 'straight' }));
    TestBed.configureTestingModule({
      imports: [RouteMap, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [
        { provide: GeolocationService, useValue: { hasRealLocation: signal(true), coords: signal(FROM), requestLocation: vi.fn() } },
        { provide: RouteRepository, useValue: { route } },
        { provide: MapStylesLoader, useValue: { ensureLoaded: vi.fn() } },
        { provide: DeviceStorage, useValue: { read: (k: string) => stored.get(k) ?? null, write: (k: string, v: string) => !!stored.set(k, v) } },
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
    const buttons = () => Array.from(el.querySelectorAll<HTMLButtonElement>('[role="group"] button'));
    return { fixture, el, buttons };
  }

  it('four icon buttons with an accessible name and a tooltip; only the selected one shows its name', async () => {
    const { buttons } = await render();
    expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual(['route.modes.walk', 'route.modes.bike', 'route.modes.moto', 'route.modes.drive']);
    expect(buttons().every((b) => b.getAttribute('title') === b.getAttribute('aria-label') && b.querySelector('svg'))).toBe(true);
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false']);
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['route.modes.walk', '', '', '']);
  });

  it('choosing the moto asks for its route, says "tiempo aproximado" and remembers it on the device', async () => {
    const { fixture, el, buttons } = await render();
    buttons()[2]?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(route).toHaveBeenLastCalledWith(FROM, { lat: 1.22, lng: -77.28 }, 'moto');
    expect(el.textContent).toContain('route.summary.moto');
    expect(el.textContent).toContain('route.approximate');
    expect(el.textContent).not.toContain('route.estimate');
    expect(stored.get('route.mode')).toBe('moto');
  });

  it('opens with the last mode chosen on this device; an unknown value falls back to walking', async () => {
    stored.set('route.mode', 'bike');
    const { buttons } = await render();
    expect(buttons()[1]?.getAttribute('aria-pressed')).toBe('true');
    expect(route).toHaveBeenCalledWith(FROM, { lat: 1.22, lng: -77.28 }, 'bike');
    stored.set('route.mode', 'plane');
    expect(TestBed.inject(TravelModePreference).read()).toBe('walk');
  });

  it('the straight-line estimate uses the documented speed of each mode', () => {
    const to = { lat: 1.23, lng: -77.27 };
    for (const [mode, kmh] of [['walk', 4.8], ['bike', 15], ['moto', 30], ['drive', 25]] as const) {
      const estimate = RouteRepository.straight(FROM, to, mode);
      expect(estimate.durationS).toBe(Math.round(estimate.distanceM / (kmh / 3.6)));
      expect(estimate.approximate ?? false).toBe(mode === 'moto');
    }
  });

  it('a route from the public OSM servers credits OpenStreetMap and links "fix the map"', async () => {
    route.mockResolvedValue({ ...RouteRepository.straight(FROM, { lat: 1.22, lng: -77.28 }, 'walk'), source: 'osm-public', attribution: 'osm' });
    const { el } = await render();
    await vi.waitFor(() => expect(el.querySelector('a[href="https://www.openstreetmap.org/copyright"]')).not.toBeNull());
    expect(el.querySelector('a[href="https://www.openstreetmap.org/fixthemap"]')).not.toBeNull();
  });
});

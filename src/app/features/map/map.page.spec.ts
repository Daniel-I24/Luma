import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessHighlightsRepository } from '@shared/business/data/business-highlights.repository';
import { BusinessRepository } from '@shared/business/data/business.repository';
import type { Business } from '@shared/business/models/business.model';
import { MapPage } from './map.page';
import { BusinessHoursCacheService } from './services/business-hours-cache.service';
import { MapCameraService } from './services/map-camera.service';
import { MapMarkerSyncService } from './services/map-marker-sync.service';
import { MapStylesLoader } from '@shared/map/map-styles.loader';
import { useFixedClock } from '../../../testing/fixed-clock';

const ES = {
  map: {
    canvasLabel: 'Mapa',
    retry: 'Reintentar',
    mapUnavailableTitle: 'Mapa no disponible',
    mapUnavailable: 'No se pudo cargar el mapa.',
    errors: { title: 'Algo salió mal' },
    nearby: { title: 'Cercanos a ti' },
    zone: { cityCentre: 'Centro de Pasto' },
  },
  businesses: { errors: { loadFailed: 'Error de carga' } },
};

const business = {
  id: 'b1',
  name: 'La Casona',
  category: 'Hamburguesas',
  latitude: 1.21,
  longitude: -77.28,
} as Business;

function setup() {
  const camera = {
    init: vi.fn(),
    destroy: vi.fn(),
    flyTo: vi.fn(),
    easeTo: vi.fn(),
    showUser: vi.fn(),
    markFetched: vi.fn(),
    currentCenter: vi.fn(() => ({ lat: 1, lng: 2 })),
    instance: {},
  };
  const repo = { getNearby: vi.fn().mockResolvedValue({ data: [business], errorKey: null }) };
  const markers = { syncMarkers: vi.fn(), select: vi.fn(), clear: vi.fn() };
  TestBed.configureTestingModule({
    imports: [
      MapPage,
      TranslocoTestingModule.forRoot({
        langs: { es: ES },
        translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
      }),
    ],
    providers: [
      provideRouter([]),
      { provide: MapCameraService, useValue: camera },
      { provide: BusinessRepository, useValue: repo },
      { provide: BusinessHoursCacheService, useValue: { prefetch: vi.fn(), get: vi.fn(() => []) } },
      {
        provide: BusinessHighlightsRepository,
        useValue: {
          getRatings: vi.fn().mockResolvedValue({ data: new Map(), errorKey: null }),
          getActivePromotions: vi.fn().mockResolvedValue({ data: [], errorKey: null }),
        },
      },
      { provide: MapMarkerSyncService, useValue: markers },
      { provide: MapStylesLoader, useValue: { ensureLoaded: vi.fn() } },
    ],
  });
  return { camera, repo, markers };
}

async function render() {
  const fixture = TestBed.createComponent(MapPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('MapPage', () => {
  useFixedClock();
  beforeEach(() => vi.clearAllMocks());

  it('starts MapLibre on the real map container and loads nearby businesses', async () => {
    const { camera, repo } = setup();

    const el = await render();

    expect(camera.init.mock.calls[0][0]).toBe(el.querySelector('.map-canvas'));
    expect(repo.getNearby).toHaveBeenCalledOnce();
  });

  it('puts a marker on the map for each loaded business with a translated label', async () => {
    const { markers } = setup();

    await render();

    const [, items] = markers.syncMarkers.mock.calls.at(-1)!;
    expect(items).toEqual([expect.objectContaining({ business, status: 'closed' })]);
    expect(items[0].label).toContain('La Casona');
  });

  it('shows the error state with retry when MapLibre fails to start', async () => {
    const { camera, repo } = setup();
    camera.init.mockImplementation(() => {
      throw new Error('WebGL not supported');
    });

    const el = await render();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Mapa no disponible');
    expect(repo.getNearby).not.toHaveBeenCalled();
  });

  it('retries starting the map and then loads businesses', async () => {
    const { camera, repo } = setup();
    camera.init.mockImplementationOnce(() => {
      throw new Error('WebGL not supported');
    });
    const el = await render();

    el.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();

    expect(camera.init).toHaveBeenCalledTimes(2);
    expect(repo.getNearby).toHaveBeenCalledOnce();
  });

  it('shows the repository error in the nearby panel', async () => {
    const { repo } = setup();
    repo.getNearby.mockResolvedValue({ data: null, errorKey: 'businesses.errors.loadFailed' });

    const el = await render();

    expect(el.querySelector('app-nearby-panel')?.textContent).toContain('Error de carga');
  });

  it('glides the map to a tapped card and opens its sheet', async () => {
    const { camera, markers } = setup();
    const el = await render();

    el.querySelector<HTMLButtonElement>('app-nearby-panel app-luma-business-card button')?.click();

    expect(camera.easeTo).toHaveBeenCalledWith(business.latitude, business.longitude);
    expect(markers.select).toHaveBeenCalledWith('b1');
  });
});

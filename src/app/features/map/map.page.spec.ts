import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MapPage } from './map.page';
import { BusinessHoursCacheService } from './services/business-hours-cache.service';
import { MapCameraService } from './services/map-camera.service';
import { MapMarkerSyncService } from './services/map-marker-sync.service';

const ES = {
  map: {
    canvasLabel: 'Mapa',
    retry: 'Reintentar',
    mapUnavailable: 'Mapa no disponible',
    errorLoading: 'Error de carga',
    loadingBusinesses: 'Cargando',
    noBusinesses: 'Sin negocios',
    centerOnMe: 'Centrar',
  },
};

function setup() {
  const camera = {
    init: vi.fn(),
    destroy: vi.fn(),
    flyTo: vi.fn(),
    markFetched: vi.fn(),
    currentCenter: vi.fn(() => ({ lat: 1, lng: 2 })),
    instance: {},
  };
  const repo = {
    getNearby: vi.fn().mockResolvedValue({ data: [], errorKey: null }),
    getActivePromotions: vi.fn().mockResolvedValue({ data: [], errorKey: null }),
  };
  TestBed.configureTestingModule({
    imports: [
      MapPage,
      TranslocoTestingModule.forRoot({
        langs: { es: ES },
        translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
      }),
    ],
    providers: [
      { provide: MapCameraService, useValue: camera },
      { provide: BusinessRepository, useValue: repo },
      {
        provide: BusinessHoursCacheService,
        useValue: { prefetch: vi.fn(), snapshot: vi.fn(() => new Map()), get: vi.fn(() => []) },
      },
      { provide: MapMarkerSyncService, useValue: { syncMarkers: vi.fn(), clear: vi.fn() } },
    ],
  });
  return { camera, repo };
}

async function render() {
  const fixture = TestBed.createComponent(MapPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('MapPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts MapLibre on the real map container and loads nearby businesses', async () => {
    const { camera, repo } = setup();

    const el = await render();

    const container = camera.init.mock.calls[0][0] as HTMLElement;
    expect(container).toBe(el.querySelector('.map-canvas'));
    expect(repo.getNearby).toHaveBeenCalledOnce();
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

  it('shows the repository error with retry', async () => {
    const { repo } = setup();
    repo.getNearby.mockResolvedValue({ data: null, errorKey: 'map.errorLoading' });

    const el = await render();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Error de carga');
  });
});

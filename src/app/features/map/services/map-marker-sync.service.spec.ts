import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MapMarkerSyncService } from './map-marker-sync.service';
import { MapMarkerFactory } from './map-marker.factory';
import type { Business, BusinessHours } from '@features/businesses/models/business.model';
import type { MarkerConfig } from './map-marker.factory';
import type maplibregl from 'maplibre-gl';

vi.mock('maplibre-gl', () => {
  class Marker {
    constructor(private readonly opts: { element: HTMLElement }) {}
    setLngLat() { return this; }
    addTo() { return this; }
    remove() { /* no-op in tests */ }
    getElement() { return this.opts.element; }
  }
  return { default: { Marker } };
});

function makeHours(
  businessId: string,
  day: BusinessHours['day_of_week'],
  opens: string,
  closes: string,
  is_closed = false,
): BusinessHours {
  return {
    id: `${businessId}-${day}`,
    business_id: businessId,
    day_of_week: day,
    opens_at: opens,
    closes_at: closes,
    is_closed,
  };
}

function makeBusiness(id: string): Business {
  return {
    id,
    owner_id: 'owner',
    name: id,
    description: null,
    category: 'cafe',
    logo_url: null,
    cover_url: null,
    latitude: 1.21,
    longitude: -77.28,
    address: 'Pasto',
    phone: null,
    is_active: true,
    created_at: '',
    updated_at: '',
  };
}

describe('MapMarkerSyncService', () => {
  let service: MapMarkerSyncService;
  let factory: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  const map = {} as maplibregl.Map;
  const mondayNoon = new Date(2024, 0, 8, 12, 0, 0);

  beforeEach(() => {
    factory = {
      create: vi.fn((status: string): MarkerConfig => {
        const element = document.createElement('div');
        element.dataset['status'] = status;
        return { element, color: '', statusClass: `marker--${status}` };
      }),
      update: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        MapMarkerSyncService,
        { provide: MapMarkerFactory, useValue: factory },
      ],
    });
    service = TestBed.inject(MapMarkerSyncService);
  });

  afterEach(() => {
    service.clear();
    TestBed.resetTestingModule();
  });

  it('syncMarkers uses each business hours, not an empty array', () => {
    const openBiz = makeBusiness('open-biz');
    const closedBiz = makeBusiness('closed-biz');
    const hoursById = new Map<string, BusinessHours[]>([
      [openBiz.id, [makeHours(openBiz.id, 1, '09:00', '20:00')]],
      [closedBiz.id, [makeHours(closedBiz.id, 1, '09:00', '20:00', true)]],
    ]);

    service.syncMarkers(map, [openBiz, closedBiz], hoursById, () => undefined, mondayNoon);

    const statuses = factory.create.mock.calls.map((call) => call[0]);
    expect(statuses).toEqual(['open', 'closed']);
  });

  it('syncMarkers would mark every business closed if hours were empty', () => {
    const biz = makeBusiness('open-biz');
    const hoursById = new Map<string, BusinessHours[]>();

    service.syncMarkers(map, [biz], hoursById, () => undefined, mondayNoon);

    expect(factory.create).toHaveBeenCalledWith('closed');
  });
});

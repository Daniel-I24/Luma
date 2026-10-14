import { TestBed } from '@angular/core/testing';
import type * as maplibregl from 'maplibre-gl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Business } from '@shared/business/models/business.model';
import { MapMarkerFactory } from './map-marker.factory';
import { MapMarkerSyncService } from './map-marker-sync.service';
import type { MarkerItem } from './map-marker-sync.service';

const removed: string[] = [];

vi.mock('maplibre-gl', () => {
  class Marker {
    constructor(private readonly opts: { element: HTMLElement }) {}
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {
      removed.push(this.opts.element.getAttribute('aria-label') ?? '');
    }
    getElement() {
      return this.opts.element;
    }
  }
  return { Marker };
});

function item(id: string, status: MarkerItem['status'] = 'open'): MarkerItem {
  const business = { id, name: id, latitude: 1.21, longitude: -77.28 } as Business;
  return { business, status, label: `${id}, ${status}` };
}

describe('MapMarkerSyncService', () => {
  let service: MapMarkerSyncService;
  let factory: MapMarkerFactory;
  const map = {} as maplibregl.Map;

  beforeEach(() => {
    removed.length = 0;
    service = TestBed.inject(MapMarkerSyncService);
    factory = TestBed.inject(MapMarkerFactory);
  });

  afterEach(() => service.clear());

  it('creates one marker per business with its status and label', () => {
    const create = vi.spyOn(factory, 'create');

    service.syncMarkers(map, [item('a'), item('b', 'closed')], () => undefined);

    expect(create.mock.calls).toEqual([
      ['open', 'a, open'],
      ['closed', 'b, closed'],
    ]);
  });

  it('updates existing markers instead of recreating them', () => {
    service.syncMarkers(map, [item('a')], () => undefined);
    const create = vi.spyOn(factory, 'create');
    const update = vi.spyOn(factory, 'update');

    service.syncMarkers(map, [item('a', 'closing-soon')], () => undefined);

    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.any(HTMLElement), 'closing-soon', 'a, closing-soon');
  });

  it('removes markers of businesses that are no longer listed', () => {
    service.syncMarkers(map, [item('a'), item('b')], () => undefined);

    service.syncMarkers(map, [item('b')], () => undefined);

    expect(removed).toEqual(['a, open']);
  });

  it('calls back with the business when a marker is clicked', () => {
    const onClick = vi.fn();
    const create = vi.spyOn(factory, 'create');
    service.syncMarkers(map, [item('a')], onClick);

    create.mock.results[0].value.click();

    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  it('keeps the selection highlighted across syncs', () => {
    const setSelected = vi.spyOn(factory, 'setSelected');
    service.syncMarkers(map, [item('a'), item('b')], () => undefined);

    service.select('b');
    service.syncMarkers(map, [item('a'), item('b')], () => undefined);

    expect(setSelected).toHaveBeenLastCalledWith(expect.any(HTMLElement), true);
  });
});

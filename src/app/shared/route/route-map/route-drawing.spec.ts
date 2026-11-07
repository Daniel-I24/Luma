import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseMap } from '@shared/map/map-base';
import type { TravelRoute } from '../route.repository';
import { RouteDrawing } from './route-drawing';

vi.mock('maplibre-gl', () => {
  class Marker {
    public setLngLat(): this { return this; }
    public addTo(): this { return this; }
  }
  class LngLatBounds {
    public extend(): this { return this; }
  }
  return { Map: class {}, Marker, LngLatBounds, setWorkerUrl: () => undefined };
});

const ROUTE: TravelRoute = { line: [[-77.28, 1.21], [-77.27, 1.22]], distanceM: 900, durationS: 600, source: 'openrouteservice' };
const FROM = { lat: 1.21, lng: -77.28 };

describe('RouteDrawing', () => {
  let fireLoad: () => void;
  const map = {
    once: vi.fn((_event: string, handler: () => void) => { fireLoad = handler; }),
    isStyleLoaded: vi.fn(() => false),
    getSource: vi.fn(() => undefined),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    setPaintProperty: vi.fn(),
    fitBounds: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(BaseMap, 'createBaseMap').mockReturnValue(map as never);
  });

  const drawing = () => new RouteDrawing(document.createElement('div'), { lat: 1.22, lng: -77.27 }, { color: '#000', animate: false });

  it('a route that arrives before the map loads is drawn when it loads', () => {
    drawing().show(ROUTE, FROM);
    expect(map.addSource).not.toHaveBeenCalled();
    fireLoad();
    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('a route after "load" is drawn even while tiles load and isStyleLoaded says false', () => {
    const d = drawing();
    fireLoad();
    map.isStyleLoaded.mockReturnValue(false);
    d.show(ROUTE, FROM);
    expect(map.addSource).toHaveBeenCalledTimes(1);
  });

  it('of two routes waiting for the map, only the newest is drawn', () => {
    const d = drawing();
    d.show(ROUTE, FROM);
    d.show({ ...ROUTE, line: [[-77.1, 1.1], [-77.2, 1.2]] }, FROM);
    fireLoad();
    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.addSource.mock.calls[0]?.[1 as never]).toMatchObject({ data: { geometry: { coordinates: [[-77.1, 1.1], [-77.2, 1.2]] } } });
  });

  it('the straight line is dashed, the route by streets is solid', () => {
    const d = drawing();
    fireLoad();
    d.show({ ...ROUTE, source: 'straight' }, FROM);
    expect(map.setPaintProperty).toHaveBeenLastCalledWith('luma-route', 'line-dasharray', [1.5, 2]);
    d.show(ROUTE, FROM);
    expect(map.setPaintProperty).toHaveBeenLastCalledWith('luma-route', 'line-dasharray', [1, 0]);
  });
});

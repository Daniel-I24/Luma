import * as maplibregl from 'maplibre-gl';
import { ExternalUrls } from '@core/config/external-urls';
import { MapTheme } from './map-theme';

/** Vector style shared by every map in the app. */
const MAP_STYLE = ExternalUrls.MAP_STYLE;
/** MapLibre web worker, copied next to index.html by angular.json (assets). */
const MAP_WORKER_PATH = 'maplibre-gl-worker.mjs';

/** Sharper than this costs GPU memory without a visible gain on a phone. */
const MAX_PIXEL_RATIO = 2;
/** Tiles kept per source once out of view: enough for going back and forth. */
const MAX_TILE_CACHE = 40;

/** BaseMap — creates a MapLibre map with Luma's style and controls. */
export class BaseMap {
  /**
   * Creates a MapLibre map with the app style. Throws (e.g.
   * GPUInitializationError without WebGL2); callers show their error state.
   */
  public static createBaseMap(
    container: HTMLElement,
    centre: { lat: number; lng: number },
    zoom: number,
  ): maplibregl.Map {
    // Bundled builds cannot locate the worker by themselves (MapLibre v6).
    maplibregl.setWorkerUrl(new URL(MAP_WORKER_PATH, document.baseURI).href);
    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: [centre.lng, centre.lat],
      zoom,
      attributionControl: false,
      pixelRatio: Math.min(globalThis.devicePixelRatio || 1, MAX_PIXEL_RATIO),
      maxTileCacheSize: MAX_TILE_CACHE,
    });
    // Map data licences require attribution; compact, and bottom-left so the
    // app's own controls (bottom-right) never cover its toggle.
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.on('style.load', () => MapTheme.apply(map, document));
    return map;
  }
}


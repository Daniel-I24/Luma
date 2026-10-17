import * as maplibregl from 'maplibre-gl';

/** Vector style shared by every map in the app. */
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
/** MapLibre web worker, copied next to index.html by angular.json (assets). */
export const MAP_WORKER_PATH = 'maplibre-gl-worker.mjs';

/**
 * Creates a MapLibre map with the app style. Throws (e.g.
 * GPUInitializationError without WebGL2); callers show their error state.
 */
export function createBaseMap(
  container: HTMLElement,
  centre: { lat: number; lng: number },
  zoom: number,
): maplibregl.Map {
  // Bundled builds cannot locate the worker by themselves (MapLibre v6).
  maplibregl.setWorkerUrl(new URL(MAP_WORKER_PATH, document.baseURI).href);
  return new maplibregl.Map({
    container,
    style: MAP_STYLE,
    center: [centre.lng, centre.lat],
    zoom,
    // Map data licences require attribution; compact keeps it out of the way.
    attributionControl: { compact: true },
  });
}

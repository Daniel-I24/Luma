/** Default map settings centred on Pasto, Nariño. */
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const DEFAULT_ZOOM = 14;
export const NEARBY_RADIUS_KM = 10;
/** Minimum map movement (degrees) before re-fetching nearby businesses. */
export const MOVE_THRESHOLD_DEG = 0.01;
export const MOVE_DEBOUNCE_MS = 600;
/** MapLibre web worker, copied next to index.html by angular.json (assets). */
export const MAP_WORKER_PATH = 'maplibre-gl-worker.mjs';

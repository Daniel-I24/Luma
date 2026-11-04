import * as maplibregl from 'maplibre-gl';
import { BaseMap } from '@shared/map/map-base';
import type { LatLng, TravelRoute } from '../route.repository';

const SOURCE = 'luma-route';
const ZOOM = 15;
/** Room around the route when the map fits it (CSS px, a MapLibre option). */
const FIT_PADDING = 48;
const LINE_WIDTH = 5;

/**
 * RouteDrawing — the MapLibre side of RouteMap: the map starts at the
 * business with its pin (no location needed); a route adds the line and the
 * customer's marker, and `fit` frames both.
 */
export class RouteDrawing {
  private readonly map: maplibregl.Map;
  private from: maplibregl.Marker | null = null;
  private bounds: maplibregl.LngLatBounds | null = null;

  constructor(
    element: HTMLElement,
    to: LatLng,
    private readonly options: { readonly color: string; readonly animate: boolean },
  ) {
    this.map = BaseMap.createBaseMap(element, to, ZOOM);
    new maplibregl.Marker({ color: options.color }).setLngLat([to.lng, to.lat]).addTo(this.map);
  }

  /** Draws (or replaces) the route from the customer and frames it. */
  public show(route: TravelRoute, from: LatLng): void {
    const draw = (): void => {
      const data = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: route.line.map(([lng, lat]) => [lng, lat]) } };
      const source = this.map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(data);
      else {
        this.map.addSource(SOURCE, { type: 'geojson', data });
        this.map.addLayer({ id: SOURCE, type: 'line', source: SOURCE, paint: { 'line-color': this.options.color, 'line-width': LINE_WIDTH }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      }
      this.from ??= new maplibregl.Marker().setLngLat([from.lng, from.lat]).addTo(this.map);
      this.from.setLngLat([from.lng, from.lat]);
      const start = route.line[0];
      this.bounds = start ? route.line.reduce((b, [lng, lat]) => b.extend([lng, lat]), new maplibregl.LngLatBounds([...start], [...start])) : null;
      this.fit();
    };
    if (this.map.isStyleLoaded()) draw();
    else this.map.once('load', draw);
  }

  /** Frames the route ("Cómo llegar"). */
  public fit(): void {
    if (this.bounds) this.map.fitBounds(this.bounds, { padding: FIT_PADDING, animate: this.options.animate });
  }

  /** Frees the map (the component was destroyed). */
  public remove(): void {
    this.map.remove();
  }
}

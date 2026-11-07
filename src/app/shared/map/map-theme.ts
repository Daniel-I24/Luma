/** The layers of a loaded style, as MapLibre lists them. */
export interface MapStyleLayer {
  readonly id: string;
  readonly type: string;
}

/** What MapTheme needs from maplibregl.Map. */
export interface PaintableMap {
  getStyle(): { readonly layers?: readonly MapStyleLayer[] } | undefined;
  setPaintProperty(layer: string, property: string, value: string): void;
  setLayoutProperty(layer: string, property: string, value: string): void;
}

/** A layer takes one colour token per paint property, or is hidden. */
type Rule = 'hide' | readonly (readonly [string, string])[];

/** Raster background, road texture and 3D buildings: noise on a phone, and a GPU cost. */
const HIDDEN = /^(natural_earth|road_area_pattern|building-3d)$/;
const GREEN = /^(park|landcover_(wood|grass|wetland))/;
const WATER = /^(water|waterway)/;
const MAJOR_ROAD = /(motorway|trunk_primary)/;

/**
 * MapTheme — Luma's colours over the vector style, read from the --color-map-*
 * tokens of the active theme, so the streets stay legible in both. Every map uses
 * it (BaseMap), so a map can never appear light inside the dark theme.
 */
export class MapTheme {
  /** What a layer of the Liberty style takes; symbols are the labels of every kind. */
  public static ruleFor(layer: MapStyleLayer): Rule {
    const { id, type } = layer;
    if (HIDDEN.test(id)) return 'hide';
    if (type === 'background') return [['background-color', 'map-land']];
    if (type === 'symbol') return [['text-color', 'map-label'], ['text-halo-color', 'map-label-halo']];
    if (type === 'fill') return [['fill-color', MapTheme.fillToken(id)]];
    if (type === 'line') return [['line-color', MapTheme.lineToken(id)]];
    return [];
  }

  /** Paints the loaded style; a layer that refuses a property keeps its own colour. */
  public static apply(map: PaintableMap, document: Document): void {
    const styles = document.defaultView?.getComputedStyle(document.documentElement);
    if (!styles) return;
    for (const layer of map.getStyle()?.layers ?? []) {
      const rule = MapTheme.ruleFor(layer);
      if (rule === 'hide') {
        map.setLayoutProperty(layer.id, 'visibility', 'none');
        continue;
      }
      for (const [property, token] of rule) {
        const value = styles.getPropertyValue(`--color-${token}`).trim();
        if (value) map.setPaintProperty(layer.id, property, value);
      }
    }
  }

  private static fillToken(id: string): string {
    if (GREEN.test(id)) return 'map-green';
    if (WATER.test(id)) return 'map-water';
    if (id === 'building') return 'map-building';
    return 'map-area';
  }

  private static lineToken(id: string): string {
    if (WATER.test(id)) return 'map-water';
    if (GREEN.test(id)) return 'map-green';
    if (id.startsWith('boundary')) return 'map-label-faint';
    if (id.includes('casing') || id.includes('rail')) return 'map-road-casing';
    return MAJOR_ROAD.test(id) ? 'map-road-major' : 'map-road';
  }
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapTheme } from './map-theme';

const layer = (id: string, type: string) => ({ id, type });

describe('MapTheme', () => {
  afterEach(() => document.documentElement.style.cssText = '');

  it('streets: main roads, other roads and their edges have their own colours', () => {
    expect(MapTheme.ruleFor(layer('road_motorway', 'line'))).toEqual([['line-color', 'map-road-major']]);
    expect(MapTheme.ruleFor(layer('road_trunk_primary', 'line'))).toEqual([['line-color', 'map-road-major']]);
    expect(MapTheme.ruleFor(layer('road_minor', 'line'))).toEqual([['line-color', 'map-road']]);
    expect(MapTheme.ruleFor(layer('bridge_street', 'line'))).toEqual([['line-color', 'map-road']]);
    expect(MapTheme.ruleFor(layer('road_minor_casing', 'line'))).toEqual([['line-color', 'map-road-casing']]);
  });

  it('land, water, parks, buildings and every label follow the theme', () => {
    expect(MapTheme.ruleFor(layer('background', 'background'))).toEqual([['background-color', 'map-land']]);
    expect(MapTheme.ruleFor(layer('water', 'fill'))).toEqual([['fill-color', 'map-water']]);
    expect(MapTheme.ruleFor(layer('waterway_river', 'line'))).toEqual([['line-color', 'map-water']]);
    expect(MapTheme.ruleFor(layer('park', 'fill'))).toEqual([['fill-color', 'map-green']]);
    expect(MapTheme.ruleFor(layer('building', 'fill'))).toEqual([['fill-color', 'map-building']]);
    expect(MapTheme.ruleFor(layer('landuse_school', 'fill'))).toEqual([['fill-color', 'map-area']]);
    expect(MapTheme.ruleFor(layer('highway-name-minor', 'symbol'))).toEqual([['text-color', 'map-label'], ['text-halo-color', 'map-label-halo']]);
  });

  it('hides what only adds noise and GPU work', () => {
    for (const id of ['natural_earth', 'road_area_pattern', 'building-3d']) expect(MapTheme.ruleFor(layer(id, 'fill'))).toBe('hide');
  });

  it('paints the loaded style with the tokens of the active theme', () => {
    document.documentElement.style.setProperty('--color-map-road', '#4d4360');
    document.documentElement.style.setProperty('--color-map-label', '#e6deef');
    const map = {
      getStyle: () => ({ layers: [layer('road_minor', 'line'), layer('label_city', 'symbol'), layer('building-3d', 'fill-extrusion')] }),
      setPaintProperty: vi.fn(),
      setLayoutProperty: vi.fn(),
    };
    MapTheme.apply(map, document);
    expect(map.setPaintProperty).toHaveBeenCalledWith('road_minor', 'line-color', '#4d4360');
    expect(map.setPaintProperty).toHaveBeenCalledWith('label_city', 'text-color', '#e6deef');
    expect(map.setLayoutProperty).toHaveBeenCalledWith('building-3d', 'visibility', 'none');
  });

  it('a style without layers is fine', () => {
    const map = { getStyle: () => undefined, setPaintProperty: vi.fn(), setLayoutProperty: vi.fn() };
    MapTheme.apply(map, document);
    expect(map.setPaintProperty).not.toHaveBeenCalled();
  });
});

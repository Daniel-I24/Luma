import { Injectable, inject } from '@angular/core';
import type { GeoCoords } from '@shared/geo/geolocation.service';
import { BaseMap } from '@shared/map/map-base';
import { MapStylesLoader } from '@shared/map/map-styles.loader';

/** The part of the map the LocationPicker uses: its centre is the point. */
export interface PickerMap {
  centre(): GeoCoords;
  moveTo(point: GeoCoords): void;
  /** Called when a move starts (the pin lifts) and ends (it drops at the new centre). */
  onMove(start: () => void, end: (centre: GeoCoords) => void): void;
  remove(): void;
}

const PICKER_ZOOM = 17;

/** PickerMapFactory — the MapLibre map of the picker; specs replace it (no WebGL in jsdom). */
@Injectable({ providedIn: 'root' })
export class PickerMapFactory {
  private readonly styles = inject(MapStylesLoader);

  /** Creates the map; throws when it cannot (the picker shows its fallback). */
  public create(container: HTMLElement, start: GeoCoords): PickerMap {
    this.styles.ensureLoaded();
    const map = BaseMap.createBaseMap(container, start, PICKER_ZOOM);
    const centre = (): GeoCoords => {
      const { lat, lng } = map.getCenter();
      return { lat, lng };
    };
    return {
      centre,
      moveTo: (point) => map.easeTo({ center: [point.lng, point.lat] }),
      onMove: (start, end) => {
        map.on('movestart', start);
        map.on('moveend', () => end(centre()));
      },
      remove: () => map.remove(),
    };
  }
}

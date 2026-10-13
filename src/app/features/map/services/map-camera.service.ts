import { Injectable } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { PASTO_CENTRE } from './geolocation.service';
import {
  DEFAULT_ZOOM,
  MAP_STYLE,
  MOVE_DEBOUNCE_MS,
  MOVE_THRESHOLD_DEG,
} from '../map.constants';

/** Owns the MapLibre instance, fly-to, and nearby-refetch on pan. */
@Injectable({ providedIn: 'root' })
export class MapCameraService {
  private map!: maplibregl.Map;
  private lastFetchCentre = PASTO_CENTRE;
  private moveDebounce: ReturnType<typeof setTimeout> | null = null;

  get instance(): maplibregl.Map {
    return this.map;
  }

  init(container: HTMLElement, onMovedFar: (lat: number, lng: number) => void): void {
    this.map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: [PASTO_CENTRE.lng, PASTO_CENTRE.lat],
      zoom: DEFAULT_ZOOM,
    });
    this.map.on('moveend', () => this.onMoveEnd(onMovedFar));
  }

  destroy(): void {
    if (this.moveDebounce) clearTimeout(this.moveDebounce);
    this.map?.remove();
  }

  flyTo(lat: number, lng: number): void {
    this.map.flyTo({ center: [lng, lat], zoom: DEFAULT_ZOOM });
  }

  markFetched(lat: number, lng: number): void {
    this.lastFetchCentre = { lat, lng };
  }

  currentCenter(): { lat: number; lng: number } {
    const c = this.map.getCenter();
    return { lat: c.lat, lng: c.lng };
  }

  private onMoveEnd(onMovedFar: (lat: number, lng: number) => void): void {
    if (this.moveDebounce) clearTimeout(this.moveDebounce);
    this.moveDebounce = setTimeout(() => {
      const c = this.map.getCenter();
      const dLat = Math.abs(c.lat - this.lastFetchCentre.lat);
      const dLng = Math.abs(c.lng - this.lastFetchCentre.lng);
      if (dLat > MOVE_THRESHOLD_DEG || dLng > MOVE_THRESHOLD_DEG) {
        onMovedFar(c.lat, c.lng);
      }
    }, MOVE_DEBOUNCE_MS);
  }
}

import { Injectable } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { PASTO_CENTRE } from '@shared/geo/geolocation.service';
import { createBaseMap } from '@shared/map/map-base';
import { DEFAULT_ZOOM, MOVE_DEBOUNCE_MS, MOVE_THRESHOLD_DEG } from '../map.constants';

/** Owns the MapLibre instance, fly-to, and nearby-refetch on pan. */
@Injectable({ providedIn: 'root' })
export class MapCameraService {
  private map!: maplibregl.Map;
  private lastFetchCentre = PASTO_CENTRE;
  private moveDebounce: ReturnType<typeof setTimeout> | null = null;
  private userMarker: maplibregl.Marker | null = null;

  get instance(): maplibregl.Map {
    return this.map;
  }

  /**
   * Creates the map. Throws (e.g. GPUInitializationError without WebGL2);
   * callers show the error state.
   */
  init(container: HTMLElement, onMovedFar: (lat: number, lng: number) => void): void {
    this.map = createBaseMap(container, PASTO_CENTRE, DEFAULT_ZOOM);
    this.map.on('moveend', () => this.onMoveEnd(onMovedFar));
  }

  destroy(): void {
    if (this.moveDebounce) clearTimeout(this.moveDebounce);
    this.userMarker = null;
    this.map?.remove();
  }

  flyTo(lat: number, lng: number): void {
    this.map.flyTo({ center: [lng, lat], zoom: DEFAULT_ZOOM });
  }

  /** Glides to a point keeping the zoom (instant under reduced motion). */
  easeTo(lat: number, lng: number): void {
    this.map.easeTo({ center: [lng, lat] });
  }

  /** Places (or moves) the user's position dot. */
  showUser(lat: number, lng: number): void {
    if (!this.userMarker) {
      const element = document.createElement('div');
      element.className = 'luma-user-dot';
      element.setAttribute('aria-hidden', 'true');
      this.userMarker = new maplibregl.Marker({ element }).setLngLat([lng, lat]).addTo(this.map);
      return;
    }
    this.userMarker.setLngLat([lng, lat]);
  }

  zoomIn(): void {
    this.map.zoomIn();
  }

  zoomOut(): void {
    this.map.zoomOut();
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

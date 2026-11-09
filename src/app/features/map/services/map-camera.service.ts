import { Injectable, signal } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { PASTO_CENTRE } from '@shared/geo/geolocation.service';
import { BaseMap } from '@shared/map/map-base';
import { DEFAULT_ZOOM, MOVE_DEBOUNCE_MS, MOVE_THRESHOLD_DEG, PLACE_ZOOM } from '../map.constants';

/** Owns the MapLibre instance, fly-to, and nearby-refetch on pan. */
@Injectable({ providedIn: 'root' })
export class MapCameraService {
  private map!: maplibregl.Map;
  private lastFetchCentre = PASTO_CENTRE;
  private moveDebounce: ReturnType<typeof setTimeout> | null = null;
  private userMarker: maplibregl.Marker | null = null;
  private placeMarker: maplibregl.Marker | null = null;
  private readonly _centre = signal<{ lat: number; lng: number } | null>(null);

  /** Where the camera is, or is flying to; follows every move once it settles. */
  public readonly centre = this._centre.asReadonly();

  /** The MapLibre map; throws if it was not created. */
  public get instance(): maplibregl.Map {
    return this.map;
  }

  /**
   * Creates the map. Throws (e.g. GPUInitializationError without WebGL2);
   * callers show the error state.
   */
  public init(container: HTMLElement, onMovedFar: (lat: number, lng: number) => void): void {
    this.map = BaseMap.createBaseMap(container, PASTO_CENTRE, DEFAULT_ZOOM);
    this.map.on('moveend', () => this.onMoveEnd(onMovedFar));
  }

  /** Removes the map and frees its WebGL context. */
  public destroy(): void {
    if (this.moveDebounce) clearTimeout(this.moveDebounce);
    this.userMarker = null;
    this.placeMarker = null;
    this._centre.set(null);
    this.map?.remove();
  }

  /** Moves the camera to a point. */
  public flyTo(lat: number, lng: number): void {
    this._centre.set({ lat, lng });
    this.map.flyTo({ center: [lng, lat], zoom: DEFAULT_ZOOM });
  }

  /** Glides to a point keeping the zoom (instant under reduced motion). */
  public easeTo(lat: number, lng: number): void {
    this.map.easeTo({ center: [lng, lat] });
  }

  /** Places (or moves) the user's position dot. */
  public showUser(lat: number, lng: number): void {
    if (!this.userMarker) {
      const element = document.createElement('div');
      element.className = 'luma-user-dot';
      element.setAttribute('aria-hidden', 'true');
      this.userMarker = new maplibregl.Marker({ element }).setLngLat([lng, lat]).addTo(this.map);
      return;
    }
    this.userMarker.setLngLat([lng, lat]);
  }

  /** Pin of the place chosen in the search, then a closer look at it. */
  public showPlace(lat: number, lng: number, label: string): void {
    if (!this.placeMarker) {
      const element = document.createElement('div');
      element.className = 'luma-place-pin';
      element.setAttribute('role', 'img');
      this.placeMarker = new maplibregl.Marker({ element, anchor: 'bottom' });
    }
    this.placeMarker.getElement().setAttribute('aria-label', label);
    this.placeMarker.setLngLat([lng, lat]).addTo(this.map);
    this._centre.set({ lat, lng });
    this.map.flyTo({ center: [lng, lat], zoom: PLACE_ZOOM });
  }

  /** Zooms in one level. */
  public zoomIn(): void {
    this.map.zoomIn();
  }

  /** Zooms out one level. */
  public zoomOut(): void {
    this.map.zoomOut();
  }

  /** Records where businesses were last fetched. */
  public markFetched(lat: number, lng: number): void {
    this.lastFetchCentre = { lat, lng };
  }

  /** Centre of the current view. */
  public currentCenter(): { lat: number; lng: number } {
    const c = this.map.getCenter();
    return { lat: c.lat, lng: c.lng };
  }

  private onMoveEnd(onMovedFar: (lat: number, lng: number) => void): void {
    if (this.moveDebounce) clearTimeout(this.moveDebounce);
    this.moveDebounce = setTimeout(() => {
      const c = this.map.getCenter();
      this._centre.set({ lat: c.lat, lng: c.lng });
      const dLat = Math.abs(c.lat - this.lastFetchCentre.lat);
      const dLng = Math.abs(c.lng - this.lastFetchCentre.lng);
      if (dLat > MOVE_THRESHOLD_DEG || dLng > MOVE_THRESHOLD_DEG) {
        onMovedFar(c.lat, c.lng);
      }
    }, MOVE_DEBOUNCE_MS);
  }
}

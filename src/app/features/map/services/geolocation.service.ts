import { Injectable, signal, computed } from '@angular/core';

export type GeoState = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';

export interface GeoCoords {
  lat: number;
  lng: number;
}

/** Fallback centre: Plaza de Nariño, Pasto, Colombia. */
export const PASTO_CENTRE: GeoCoords = { lat: 1.2136, lng: -77.2811 };

/**
 * GeolocationService — wraps the browser Geolocation API with Signals.
 *
 * Asks for permission only when the user explicitly triggers it so we can
 * show an explanation (map.locationPermission) before the native prompt.
 */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly _state = signal<GeoState>('idle');
  private readonly _coords = signal<GeoCoords>(PASTO_CENTRE);

  readonly state = computed(() => this._state());
  readonly coords = computed(() => this._coords());

  /** True only after a successful geolocation response. */
  readonly hasRealLocation = computed(() => this._state() === 'granted');

  /**
   * Requests the user's current position.
   * Sets state to 'locating' while waiting; resolves to 'granted' or 'denied'.
   */
  requestLocation(): void {
    if (!navigator.geolocation) {
      this._state.set('unavailable');
      return;
    }

    this._state.set('locating');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this._coords.set({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        this._state.set('granted');
      },
      () => {
        // Permission denied or any error: keep Pasto centre as fallback.
        this._state.set('denied');
      },
      { timeout: 10_000, maximumAge: 60_000 },
    );
  }
}

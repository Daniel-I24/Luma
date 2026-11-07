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
  private readonly _accuracy = signal<number | null>(null);
  private watchId: number | null = null;
  private followers = 0;

  public readonly state = computed(() => this._state());
  public readonly coords = computed(() => this._coords());
  /** Accuracy of the last real position, in metres (null until one arrives). */
  public readonly accuracy = this._accuracy.asReadonly();

  /** True only after a successful geolocation response. */
  public readonly hasRealLocation = computed(() => this._state() === 'granted');

  /** Centre to use while the real location is unknown (e.g. the municipality of residence). */
  public useFallback(coords: GeoCoords): void {
    if (this._state() !== 'granted') this._coords.set(coords);
  }

  /**
   * Requests the user's current position.
   * Sets state to 'locating' while waiting; resolves to 'granted' or 'denied'.
   * `highAccuracy` ("Estoy en el local"): GPS, a fresh fix, a longer wait.
   */
  public requestLocation(highAccuracy = false): void {
    if (!navigator.geolocation) {
      this._state.set('unavailable');
      return;
    }

    this._state.set('locating');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this._coords.set({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        this._accuracy.set(Math.round(pos.coords.accuracy));
        this._state.set('granted');
      },
      () => {
        // Permission denied or any error: keep the fallback centre (residence or Pasto).
        this._state.set('denied');
      },
      highAccuracy ? { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 } : { timeout: 10_000, maximumAge: 60_000 },
    );
  }

  /** Reads the position without asking when the permission was already given. */
  public async requestIfAllowed(): Promise<void> {
    if (this._state() === 'granted' || this._state() === 'locating') return;
    try {
      const status = await navigator.permissions?.query({ name: 'geolocation' });
      if (status?.state === 'granted') this.requestLocation();
    } catch {
      // No Permissions API here: the screen keeps its "Activar ubicación".
    }
  }

  /**
   * Keeps the position current while someone needs it (the route map): one GPS
   * watch for all of them. A failed reading keeps the last position. Returns the stop.
   */
  public follow(): () => void {
    if (!navigator.geolocation) return () => undefined;
    if (this.followers++ === 0) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          this._coords.set({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          this._accuracy.set(Math.round(pos.coords.accuracy));
        },
        () => undefined,
        { maximumAge: 10_000, timeout: 30_000 },
      );
    }
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      if (--this.followers === 0 && this.watchId !== null) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
    };
  }
}

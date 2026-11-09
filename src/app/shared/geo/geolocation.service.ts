import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocationError, type LocationAccess, type LocationFailure, type LocationReadOptions, type LocationReading, type LocationSource } from '@core/location/location-source';
import { NativeLocationSource } from '@core/location/native-location-source';
import { WebLocationSource } from '@core/location/web-location-source';
import { FRESH_GPS, GOOD_ACCURACY_M, LocationPlan } from './location-plan';

export type GeoState = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';
export type { LocationFailure };

export interface GeoCoords {
  lat: number;
  lng: number;
}

/** The last attempt, with no position in it: for the technical information. */
export interface LocationAttempt {
  readonly outcome: 'ok' | LocationFailure;
  readonly source: LocationSource['kind'];
  readonly access: LocationAccess;
  readonly accuracyM: number | null;
  readonly code: string | null;
  readonly at: Date;
  readonly ms: number;
}

/** Fallback centre: Plaza de Nariño, Pasto, Colombia. */
export const PASTO_CENTRE: GeoCoords = { lat: 1.2136, lng: -77.2811 };

export const LOCATION_SOURCE = new InjectionToken<LocationSource>('LOCATION_SOURCE', {
  providedIn: 'root',
  factory: () => (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Geolocation') ? new NativeLocationSource() : new WebLocationSource()),
});

/**
 * GeolocationService — the position as Signals, from the plugin in the app and the browser on
 * the web. Asks only when the user triggers it (map.locationPermission explains why first).
 */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly source = inject(LOCATION_SOURCE);
  private readonly _state = signal<GeoState>('idle');
  private readonly _coords = signal<GeoCoords>(PASTO_CENTRE);
  private readonly _accuracy = signal<number | null>(null);
  private readonly _failure = signal<LocationFailure | null>(null);
  private readonly _lastAttempt = signal<LocationAttempt | null>(null);
  private stopWatch: (() => void) | null = null;
  private followers = 0;
  /** Only the latest attempt may touch the state. */
  private attempt = 0;

  public readonly state = computed(() => this._state());
  public readonly coords = computed(() => this._coords());
  /** Accuracy of the last real position, in metres (null until one arrives). */
  public readonly accuracy = this._accuracy.asReadonly();
  /** Why the last attempt failed; null otherwise. */
  public readonly failure = this._failure.asReadonly();
  public readonly lastAttempt = this._lastAttempt.asReadonly();

  /** True only after a successful geolocation response. */
  public readonly hasRealLocation = computed(() => this._state() === 'granted');

  /** Centre to use while the real location is unknown (e.g. the municipality of residence). */
  public useFallback(coords: GeoCoords): void {
    if (this._state() !== 'granted') this._coords.set(coords);
  }

  /** Asks for the permission if needed, then reads. `highAccuracy` ("Estoy en el local"): only a fresh GPS fix. */
  public requestLocation(highAccuracy = false): void {
    void this.locate(highAccuracy, () => this.source.request());
  }

  /** Reads the position without asking when the permission was already given. */
  public async requestIfAllowed(): Promise<void> {
    if (this._state() === 'granted' || this._state() === 'locating') return;
    const access = await this.source.access().catch((): LocationAccess => 'prompt');
    if (access === 'granted' || access === 'approximate') void this.locate(false, () => Promise.resolve(access));
  }

  /** Keeps the position current while someone needs it (the route map): one watch for all. Returns the stop. */
  public follow(): () => void {
    if (this.followers++ === 0) this.stopWatch = this.source.watch((reading) => this.show(reading));
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      if (--this.followers === 0) {
        this.stopWatch?.();
        this.stopWatch = null;
      }
    };
  }

  private async locate(highAccuracy: boolean, ask: () => Promise<LocationAccess>): Promise<void> {
    const attempt = ++this.attempt;
    const started = Date.now();
    this._state.set('locating');
    this._failure.set(null);
    let access: LocationAccess = 'prompt';
    try {
      access = await ask();
      if (access === 'denied') throw new LocationError('denied');
      const reading = await this.firstFix(LocationPlan.readings(highAccuracy, access));
      if (attempt !== this.attempt) return;
      this.show(reading);
      this._state.set('granted');
      this.record(started, { outcome: 'ok', access, accuracyM: reading.accuracyM, code: null });
      if (!highAccuracy && access !== 'approximate' && reading.accuracyM > GOOD_ACCURACY_M) void this.refine(attempt, reading.accuracyM);
    } catch (error) {
      if (attempt !== this.attempt) return;
      const failure = error instanceof LocationError ? error : new LocationError('unavailable');
      this._state.set(failure.reason === 'denied' ? 'denied' : 'unavailable');
      this._failure.set(failure.reason);
      this.record(started, { outcome: failure.reason, access, accuracyM: null, code: failure.code });
    }
  }

  private async firstFix(plan: readonly LocationReadOptions[]): Promise<LocationReading> {
    let last: unknown = new LocationError('unavailable');
    for (const options of plan) {
      try {
        return await this.source.read(options);
      } catch (error) {
        last = error;
        if (error instanceof LocationError && (error.reason === 'denied' || error.reason === 'servicesOff')) break;
      }
    }
    throw last;
  }

  /** The precise position after the approximate one; a failure keeps what is on screen. */
  private async refine(attempt: number, accuracyM: number): Promise<void> {
    const better = await this.source.read(FRESH_GPS).catch(() => null);
    if (better && attempt === this.attempt && better.accuracyM < accuracyM) this.show(better);
  }

  private show({ lat, lng, accuracyM }: LocationReading): void {
    this._coords.set({ lat, lng });
    this._accuracy.set(accuracyM);
  }

  private record(started: number, result: Pick<LocationAttempt, 'outcome' | 'access' | 'accuracyM' | 'code'>): void {
    this._lastAttempt.set({ ...result, source: this.source.kind, at: new Date(started), ms: Date.now() - started });
  }
}

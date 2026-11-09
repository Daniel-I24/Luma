import { LocationError, type LocationAccess, type LocationFailure, type LocationReadOptions, type LocationReading, type LocationSource } from './location-source';

const PERMISSION_DENIED = 1;
const TIMEOUT = 3;
const WATCH_MAX_AGE_MS = 10_000;
const WATCH_TIMEOUT_MS = 30_000;

const toReading = (position: GeolocationPosition): LocationReading => ({
  lat: position.coords.latitude,
  lng: position.coords.longitude,
  accuracyM: Math.round(position.coords.accuracy),
});

function reasonOf(code: number): LocationFailure {
  if (code === PERMISSION_DENIED) return 'denied';
  return code === TIMEOUT ? 'timeout' : 'unavailable';
}

/** WebLocationSource — the browser's Geolocation API (web and Safari on iPhone). */
export class WebLocationSource implements LocationSource {
  public readonly kind = 'web';

  /** @inheritdoc */
  public async access(): Promise<LocationAccess> {
    try {
      const status = await navigator.permissions?.query({ name: 'geolocation' });
      if (status?.state === 'granted') return 'granted';
      return status?.state === 'denied' ? 'denied' : 'prompt';
    } catch {
      // No Permissions API for geolocation here (older Safari).
      return 'prompt';
    }
  }

  /** The browser asks by itself on the first reading. */
  public request(): Promise<LocationAccess> {
    return Promise.resolve('prompt');
  }

  /** @inheritdoc */
  public read({ precise, timeoutMs, maxAgeMs }: LocationReadOptions): Promise<LocationReading> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new LocationError('unavailable', 'no-api'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(toReading(position)),
        (error) => reject(new LocationError(reasonOf(error.code), `web-${error.code}`)),
        { enableHighAccuracy: precise, timeout: timeoutMs, maximumAge: maxAgeMs },
      );
    });
  }

  /** @inheritdoc */
  public watch(onReading: (reading: LocationReading) => void): () => void {
    if (!navigator.geolocation) return () => undefined;
    const id = navigator.geolocation.watchPosition(
      (position) => onReading(toReading(position)),
      () => undefined,
      { maximumAge: WATCH_MAX_AGE_MS, timeout: WATCH_TIMEOUT_MS },
    );
    return () => navigator.geolocation.clearWatch(id);
  }
}

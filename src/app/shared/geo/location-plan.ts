import type { LocationAccess, LocationReadOptions } from '@core/location/location-source';

/** Quick: the network or a recent position, which also works indoors. */
const APPROXIMATE: LocationReadOptions = { precise: false, timeoutMs: 8_000, maxAgeMs: 300_000 };
/** Only "aproximada" was allowed: no GPS to fall back on, so it waits longer. */
const PATIENT_APPROXIMATE: LocationReadOptions = { precise: false, timeoutMs: 20_000, maxAgeMs: 600_000 };
/** When the quick one gave nothing. */
const GPS: LocationReadOptions = { precise: true, timeoutMs: 15_000, maxAgeMs: 60_000 };
/** A fresh fix ("Estoy en el local") and the refinement after the first position. */
export const FRESH_GPS: LocationReadOptions = { precise: true, timeoutMs: 20_000, maxAgeMs: 0 };
/** Metres from which a position is good enough not to look for a better one. */
export const GOOD_ACCURACY_M = 50;

/** LocationPlan — which readings to try for a request. */
export class LocationPlan {
  /** In order. With the location off, the GPS read shows the system's dialog. */
  public static readings(highAccuracy: boolean, access: LocationAccess): LocationReadOptions[] {
    if (highAccuracy) return [FRESH_GPS];
    if (access === 'approximate') return [APPROXIMATE, PATIENT_APPROXIMATE];
    return access === 'servicesOff' ? [GPS, APPROXIMATE] : [APPROXIMATE, GPS];
  }
}

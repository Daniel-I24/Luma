/** Why a position could not be read. */
export type LocationFailure = 'denied' | 'servicesOff' | 'timeout' | 'unavailable';

/** A failed reading; `code` is what the platform answered (for the technical information). */
export class LocationError extends Error {
  constructor(
    public readonly reason: LocationFailure,
    public readonly code: string | null = null,
  ) {
    super(reason);
  }
}

export interface LocationReading {
  readonly lat: number;
  readonly lng: number;
  readonly accuracyM: number;
}

export interface LocationReadOptions {
  /** GPS when it can; otherwise the cheaper network or last known position. */
  readonly precise: boolean;
  readonly timeoutMs: number;
  readonly maxAgeMs: number;
}

/**
 * What the app may do: precise, approximate only ("aproximada" on Android 12+), not asked
 * yet, refused, or unknown because the location of the system is off (Android answers no
 * permission state then).
 */
export type LocationAccess = 'granted' | 'approximate' | 'prompt' | 'denied' | 'servicesOff';

/** One way of reading the position: the Capacitor plugin in the app, the browser on the web. */
export interface LocationSource {
  readonly kind: 'native' | 'web';
  /** The current permission, without asking. */
  access(): Promise<LocationAccess>;
  /** Asks for the permission when the platform does it apart from the reading. */
  request(): Promise<LocationAccess>;
  /** Rejects with a LocationError. */
  read(options: LocationReadOptions): Promise<LocationReading>;
  /** Follows the position; failed readings are ignored. Returns the stop. */
  watch(onReading: (reading: LocationReading) => void): () => void;
}

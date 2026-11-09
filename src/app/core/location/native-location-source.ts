import { LocationError, type LocationAccess, type LocationFailure, type LocationReadOptions, type LocationReading, type LocationSource } from './location-source';

/** Answers of the Capacitor plugin (its README lists them), by what the user can do. */
const REASON_BY_CODE: Readonly<Record<string, LocationFailure>> = {
  'OS-PLUG-GLOC-0003': 'denied',
  'OS-PLUG-GLOC-0008': 'denied',
  'OS-PLUG-GLOC-0007': 'servicesOff',
  'OS-PLUG-GLOC-0009': 'servicesOff',
  'OS-PLUG-GLOC-0016': 'servicesOff',
  'OS-PLUG-GLOC-0017': 'servicesOff',
  'OS-PLUG-GLOC-0010': 'timeout',
};
const SERVICES_OFF = 'OS-PLUG-GLOC-0007';
const WATCH_INTERVAL_MS = 10_000;
const WATCH_TIMEOUT_MS = 30_000;

interface PluginStatus {
  readonly location: string;
  readonly coarseLocation: string;
}
interface PluginPosition {
  readonly coords: { readonly latitude: number; readonly longitude: number; readonly accuracy: number };
}

const toReading = ({ coords }: PluginPosition): LocationReading => ({
  lat: coords.latitude,
  lng: coords.longitude,
  accuracyM: Math.round(coords.accuracy),
});

function toAccess({ location, coarseLocation }: PluginStatus): LocationAccess {
  if (location === 'granted') return 'granted';
  if (coarseLocation === 'granted') return 'approximate';
  return location === 'denied' || coarseLocation === 'denied' ? 'denied' : 'prompt';
}

const codeOf = (error: unknown): string | null => (error as { readonly code?: string } | null)?.code ?? null;

function toError(error: unknown): LocationError {
  const code = codeOf(error);
  return new LocationError((code && REASON_BY_CODE[code]) || 'unavailable', code);
}

/**
 * NativeLocationSource — @capacitor/geolocation in the app. Fused location with Google Play
 * Services (it also shows the system's "turn on location"), Android's LocationManager without
 * them (enableLocationFallback, Huawei), Core Location on iPhone. The WebView's own
 * geolocation depended on the network provider of each phone.
 */
export class NativeLocationSource implements LocationSource {
  public readonly kind = 'native';

  /** @inheritdoc */
  public access(): Promise<LocationAccess> {
    return this.status((plugin) => plugin.checkPermissions());
  }

  /** Asks for both precisions: Android shows one dialog. */
  public request(): Promise<LocationAccess> {
    return this.status((plugin) => plugin.requestPermissions({ permissions: ['location', 'coarseLocation'] }));
  }

  /** @inheritdoc */
  public async read({ precise, timeoutMs, maxAgeMs }: LocationReadOptions): Promise<LocationReading> {
    const { Geolocation } = await import('@capacitor/geolocation');
    try {
      return toReading(
        await Geolocation.getCurrentPosition({ enableHighAccuracy: precise, timeout: timeoutMs, maximumAge: maxAgeMs, enableLocationFallback: true }),
      );
    } catch (error) {
      throw toError(error);
    }
  }

  /** @inheritdoc */
  public watch(onReading: (reading: LocationReading) => void): () => void {
    let stopped = false;
    let id: string | null = null;
    const clear = async (): Promise<void> => {
      const { Geolocation } = await import('@capacitor/geolocation');
      if (id) await Geolocation.clearWatch({ id }).catch(() => undefined);
    };
    void import('@capacitor/geolocation')
      .then(({ Geolocation: plugin }) =>
        plugin.watchPosition({ interval: WATCH_INTERVAL_MS, timeout: WATCH_TIMEOUT_MS }, (position) => {
          if (position && !stopped) onReading(toReading(position));
        }),
      )
      .then((started) => {
        id = started;
        return stopped ? clear() : undefined;
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
      void clear();
    };
  }

  /** The location of the system being off is an answer, not a failure of the question. */
  private async status(
    ask: (plugin: typeof import('@capacitor/geolocation').Geolocation) => Promise<PluginStatus>,
  ): Promise<LocationAccess> {
    const { Geolocation } = await import('@capacitor/geolocation');
    try {
      return toAccess(await ask(Geolocation));
    } catch (error) {
      if (codeOf(error) === SERVICES_OFF) return 'servicesOff';
      throw toError(error);
    }
  }
}

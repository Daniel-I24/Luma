import { Injectable, inject } from '@angular/core';
import { DeviceStorage } from '@core/storage/device-storage';
import type { IconName } from '@design-system';

/** How the customer travels. Kept in sync with supabase/functions/route/profiles.ts. */
export type TravelMode = 'walk' | 'bike' | 'moto' | 'drive';

/** A mode as the app shows it, with the speed of the straight-line estimate (docs/route.md). */
export interface TravelModeInfo {
  readonly mode: TravelMode;
  readonly icon: IconName;
  readonly straightKmh: number;
  /** The moto uses the car's profile with an adjusted time. */
  readonly approximate: boolean;
  /** Its name in Google Maps' URL. */
  readonly google: string;
}

export /** Never empty: the first mode is the default. */
const TRAVEL_MODES: readonly [TravelModeInfo, ...TravelModeInfo[]] = [
  { mode: 'walk', icon: 'walk', straightKmh: 4.8, approximate: false, google: 'walking' },
  { mode: 'bike', icon: 'bike', straightKmh: 15, approximate: false, google: 'bicycling' },
  { mode: 'moto', icon: 'moto', straightKmh: 30, approximate: true, google: 'two-wheeler' },
  { mode: 'drive', icon: 'car', straightKmh: 25, approximate: false, google: 'driving' },
];

const KEY = 'route.mode';

/** TravelModePreference — the last mode chosen, remembered on this device. */
@Injectable({ providedIn: 'root' })
export class TravelModePreference {
  private readonly storage = inject(DeviceStorage);

  /** The remembered mode, walking when none (or an unknown value) is stored. */
  public read(): TravelMode {
    const stored = this.storage.read(KEY);
    return TRAVEL_MODES.find((info) => info.mode === stored)?.mode ?? 'walk';
  }

  /** Remembers the mode; a device that refuses storage simply forgets it. */
  public write(mode: TravelMode): void {
    this.storage.write(KEY, mode);
  }

  /** The info of a mode. */
  public static info(mode: TravelMode): TravelModeInfo {
    return TRAVEL_MODES.find((info) => info.mode === mode) ?? TRAVEL_MODES[0];
  }
}

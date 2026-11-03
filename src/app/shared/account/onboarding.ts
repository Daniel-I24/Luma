import { Injectable, inject } from '@angular/core';
import { DeviceStorage } from '@core/storage/device-storage';

/**
 * Version of the welcome tutorial. Raise it when the slides change and every
 * device shows the new ones once.
 */
const ONBOARDING_VERSION = 1;

/** Route of the tutorial; Settings links to it to watch it again. */
export const ONBOARDING_PATH = '/welcome';

const SEEN_KEY = `welcome.v${ONBOARDING_VERSION}`;

/**
 * WelcomeTutorial — the welcome screens are shown the FIRST time the app is
 * opened on a device, not at every sign-in. Without storage they are shown
 * once per app start at most (the flag also lives in memory).
 */
@Injectable({ providedIn: 'root' })
export class WelcomeTutorial {
  private readonly storage = inject(DeviceStorage);
  private seenThisRun = false;

  /** True until the tutorial was finished or skipped on this device. */
  public needed(): boolean {
    return !this.seenThisRun && this.storage.read(SEEN_KEY) === null;
  }

  /** "Omitir" or "Empezar". */
  public markSeen(): void {
    this.seenThisRun = true;
    this.storage.write(SEEN_KEY, new Date().toISOString());
  }

  /** Settings → "Ver todos los tutoriales": the welcome shows again at the next start. */
  public reset(): void {
    this.seenThisRun = false;
    this.storage.remove(SEEN_KEY);
  }
}

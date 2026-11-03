import { InjectionToken } from '@angular/core';

/**
 * Where the APK reads /version.json: the deployed web app (e.g.
 * 'https://luma.vercel.app'). Null by default: the APK then skips the check.
 * The web build always checks its own origin.
 */
export const UPDATE_SITE_URL = new InjectionToken<string | null>('UPDATE_SITE_URL', {
  providedIn: 'root',
  factory: () => null,
});

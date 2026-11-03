import { InjectionToken } from '@angular/core';

/**
 * Whether the APK has Firebase configured (android/app/google-services.json,
 * never committed). Off by default: registering for push without it crashes
 * the Android app. Switch to true here only after following docs/push.md.
 */
export const PUSH_ENABLED = new InjectionToken<boolean>('PUSH_ENABLED', {
  providedIn: 'root',
  factory: () => false,
});

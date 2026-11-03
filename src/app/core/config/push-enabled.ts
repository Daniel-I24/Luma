import { InjectionToken } from '@angular/core';

declare const LUMA_PUSH_ENABLED: string | undefined;

/**
 * Whether the APK has Firebase configured (android/app/google-services.json,
 * never committed). Set by the build (scripts/build-flags.mjs: on when the
 * file is there, or PUSH_ENABLED=1/0); off in tests and plain `ng serve`, as
 * registering for push without Firebase crashes the Android app
 * (docs/push-setup.md).
 */
export const PUSH_ENABLED = new InjectionToken<boolean>('PUSH_ENABLED', {
  providedIn: 'root',
  factory: () => typeof LUMA_PUSH_ENABLED !== 'undefined' && LUMA_PUSH_ENABLED === 'true',
});

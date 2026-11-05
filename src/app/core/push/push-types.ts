import { InjectionToken } from '@angular/core';

/** Set by scripts/build-flags.mjs (`ng build --define`). */
declare const LUMA_PUSH_ENABLED: string | undefined;

/**
 * Whether the APK has Firebase configured (android/app/google-services.json,
 * never committed): on when the file was in the build, or PUSH_ENABLED=1/0;
 * off in tests and plain `ng serve`, as registering for push without
 * Firebase crashes the Android app (docs/push-setup.md).
 */
export const PUSH_ENABLED = new InjectionToken<boolean>('PUSH_ENABLED', {
  providedIn: 'root',
  factory: () => typeof LUMA_PUSH_ENABLED !== 'undefined' && LUMA_PUSH_ENABLED === 'true',
});

/** Android notification importance: high shows heads-up. */
export const ANDROID_IMPORTANCE = { high: 4, normal: 3 } as const;
type AndroidImportance = (typeof ANDROID_IMPORTANCE)[keyof typeof ANDROID_IMPORTANCE];

/** 'unavailable' on the web; 'not_configured' on a phone built without Firebase. */
export type PushPermission = 'granted' | 'denied' | 'prompt' | 'unavailable' | 'not_configured';

/** What a tapped notification carries (ids only, from push-dispatch). */
export interface PushAction {
  readonly type: string | null;
  readonly orderId: string | null;
  readonly businessId: string | null;
}

/** An Android notification channel; push-dispatch sends to 'orders' or 'promotions'. */
export interface PushChannel {
  readonly id: 'orders' | 'promotions';
  readonly name: string;
  readonly description: string;
  readonly importance: AndroidImportance;
}

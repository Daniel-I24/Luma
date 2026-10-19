import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * NativeHaptics — a short tap for confirmations (add to cart, favourite,
 * order placed): @capacitor/haptics on the device, the Vibration API on the
 * web when available, nothing otherwise. Never throws: haptics are a nicety.
 */
@Injectable({ providedIn: 'root' })
export class NativeHaptics {
  private readonly navigator = inject(DOCUMENT).defaultView?.navigator;

  async tap(): Promise<void> {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Light });
        return;
      }
      this.navigator?.vibrate?.(10);
    } catch {
      // A device without haptics simply does not vibrate.
    }
  }
}

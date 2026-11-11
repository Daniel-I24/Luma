import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * ExternalBrowser — opens a page outside the app: the system browser tab on
 * Android (@capacitor/browser), the same tab on the web. Used for Wompi's
 * hosted checkout, so no payment page ever runs inside the app's WebView.
 */
@Injectable({ providedIn: 'root' })
export class ExternalBrowser {
  private readonly document = inject(DOCUMENT);

  /**
   * Opens a URL outside the app: the system browser on the phone (the app
   * stays), this tab on the web (the page leaves).
   * @returns true when this page is leaving.
   */
  public async open(url: string): Promise<boolean> {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Browser')) {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
      return false;
    }
    this.document.location.assign(url);
    return true;
  }
}

/** Web fallback: a vibration short enough to feel like a tap. */
const TAP_VIBRATION_MS = 10;

/**
 * NativeHaptics — a short tap for confirmations (add to cart, favourite,
 * order placed): @capacitor/haptics on the device, the Vibration API on the
 * web when available, nothing otherwise. Never throws: haptics are a nicety.
 */
@Injectable({ providedIn: 'root' })
export class NativeHaptics {
  private readonly navigator = inject(DOCUMENT).defaultView?.navigator;

  /** A light tap of haptic feedback (vibration fallback on the web). */
  public async tap(): Promise<void> {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Haptics')) {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Light });
        return;
      }
      this.navigator?.vibrate?.(TAP_VIBRATION_MS);
    } catch {
      // A device without haptics simply does not vibrate.
    }
  }
}

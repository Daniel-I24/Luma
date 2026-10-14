import { Injectable } from '@angular/core';

/**
 * NativeStatusBar — thin adapter over @capacitor/status-bar so the rest of
 * the app (and its tests) never touch the plugin directly. Capacitor is
 * loaded lazily so the web bundle does not pay for native-only code.
 */
@Injectable({ providedIn: 'root' })
export class NativeStatusBar {
  async isAvailable(): Promise<boolean> {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  }

  /** Lets the web view draw under the status bar (edge to edge). */
  async overlayWebView(): Promise<void> {
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: true });
  }

  /** `light-content` = light icons for dark backgrounds. */
  async setContent(content: 'light-content' | 'dark-content'): Promise<void> {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: content === 'light-content' ? Style.Dark : Style.Light });
  }
}

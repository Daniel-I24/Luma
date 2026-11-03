import { DOCUMENT, Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * NativeShell — Android behaviour of the APK: the hardware back button goes
 * back in the app (and closes it on the first screen), and the focused field
 * scrolls into view when the keyboard opens. Plugins are loaded lazily and
 * only on the native platform; on the web this does nothing.
 */
@Injectable({ providedIn: 'root' })
export class NativeShell {
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);

  /** Wires the Android back button and keyboard behaviour (native only). */
  public async init(): Promise<void> {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('App')) return;
    const [{ App }, { Keyboard }] = await Promise.all([
      import('@capacitor/app'),
      import('@capacitor/keyboard'),
    ]);
    await App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) this.location.back();
      else void App.exitApp();
    });
    await Keyboard.addListener('keyboardDidShow', () => {
      const focused = this.document.activeElement;
      if (focused instanceof HTMLElement) focused.scrollIntoView({ block: 'center' });
    });
  }
}

/**
 * NativeStatusBar — thin adapter over @capacitor/status-bar so the rest of
 * the app (and its tests) never touch the plugin directly. Capacitor is
 * loaded lazily so the web bundle does not pay for native-only code.
 */
@Injectable({ providedIn: 'root' })
export class NativeStatusBar {
  /** True when the status bar plugin can be used. */
  public async isAvailable(): Promise<boolean> {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('StatusBar');
  }

  /** Lets the web view draw under the status bar (edge to edge). */
  public async overlayWebView(): Promise<void> {
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: true });
  }

  /** `light-content` = light icons for dark backgrounds. */
  public async setContent(content: 'light-content' | 'dark-content'): Promise<void> {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: content === 'light-content' ? Style.Dark : Style.Light });
  }
}

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

  async init(): Promise<void> {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
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

import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * ConnectivityService — whether the device is online. The browser's online
 * and offline events everywhere; on Android also @capacitor/network (loaded
 * lazily), which notices changes the WebView may miss.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly _online = signal(this.window?.navigator.onLine ?? true);
  readonly online = this._online.asReadonly();

  constructor() {
    const set = (online: boolean) => () => this._online.set(online);
    const onOnline = set(true);
    const onOffline = set(false);
    this.window?.addEventListener('online', onOnline);
    this.window?.addEventListener('offline', onOffline);
    inject(DestroyRef).onDestroy(() => {
      this.window?.removeEventListener('online', onOnline);
      this.window?.removeEventListener('offline', onOffline);
    });
  }

  /** Native network status (no-op on the web); call once at startup. */
  async watchNative(): Promise<void> {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { Network } = await import('@capacitor/network');
    this._online.set((await Network.getStatus()).connected);
    await Network.addListener('networkStatusChange', (status) =>
      this._online.set(status.connected),
    );
  }
}

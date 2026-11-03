import { Injectable, signal } from '@angular/core';

/** Called with every luma:// link that opens the app. */
export type AppUrlListener = (url: string) => void;

/**
 * AppEvents — what the Android app tells the web layer: it came back to the
 * foreground (`resumes` counts it, for screens that must re-read the server)
 * and it was opened by a luma:// link (Wompi's return after a payment).
 * Plugins load lazily and only on the native platform.
 */
@Injectable({ providedIn: 'root' })
export class AppEvents {
  private readonly _resumes = signal(0);
  private readonly urlListeners = new Set<AppUrlListener>();

  /** Increases each time the app returns to the foreground. */
  public readonly resumes = this._resumes.asReadonly();

  /** Registers a listener; the returned function removes it. */
  public onUrl(listener: AppUrlListener): () => void {
    this.urlListeners.add(listener);
    return () => this.urlListeners.delete(listener);
  }

  /** Starts listening to deep links and app resume (native only). */
  public async init(): Promise<void> {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('App')) return;
    const { App } = await import('@capacitor/app');
    await App.addListener('resume', () => this._resumes.update((n) => n + 1));
    await App.addListener('appUrlOpen', ({ url }) => this.emit(url));
    // A cold start from the link: the event fired before the listener existed.
    const launch = await App.getLaunchUrl();
    if (launch?.url) this.emit(launch.url);
  }

  /** Delivers a link to every listener (also used by tests). */
  public emit(url: string): void {
    for (const listener of this.urlListeners) listener(url);
  }
}

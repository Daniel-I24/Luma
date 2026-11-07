import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { ExternalUrls } from '@core/config/external-urls';

/**
 * ExternalMaps — leaves the app for the phone's maps. On Android a navigation to
 * another host becomes an ACTION_VIEW intent (Capacitor's Bridge), so the Google
 * Maps link opens its app and geo: offers whichever map app is installed. On the
 * web a new tab with the same directions.
 */
@Injectable({ providedIn: 'root' })
export class ExternalMaps {
  private readonly document = inject(DOCUMENT);

  /** Opens a maps URL ("Abrir en Google Maps"). */
  public async open(url: string): Promise<void> {
    if (await this.isNative()) this.document.location.assign(url);
    else this.document.defaultView?.open(url, '_blank', 'noopener');
  }

  /** The phone's navigation to a place: the fallback when no route can be drawn here. */
  public async navigate(lat: number, lng: number, name: string): Promise<void> {
    if (await this.isNative()) this.document.location.assign(ExternalUrls.geo(lat, lng, name));
    else this.document.defaultView?.open(ExternalUrls.directions(`${lat},${lng}`), '_blank', 'noopener');
  }

  private async isNative(): Promise<boolean> {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  }
}

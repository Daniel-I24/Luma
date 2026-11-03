import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * ExternalBrowser — opens a page outside the app: the system browser tab on
 * Android (@capacitor/browser), the same tab on the web. Used for Wompi's
 * hosted checkout, so no payment page ever runs inside the app's WebView.
 */
@Injectable({ providedIn: 'root', useFactory: () => new CapacitorExternalBrowser(inject(DOCUMENT)) })
export abstract class ExternalBrowser {
  public abstract open(url: string): Promise<void>;
}

export class CapacitorExternalBrowser extends ExternalBrowser {
  public constructor(private readonly document: Document) {
    super();
  }

  public async open(url: string): Promise<void> {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
      return;
    }
    this.document.location.assign(url);
  }
}

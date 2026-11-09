import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface LumaSettingsPlugin {
  openLocationSettings(): Promise<void>;
  openAppSettings(): Promise<void>;
}

const PLUGIN = 'LumaSettings';
const LumaSettings = registerPlugin<LumaSettingsPlugin>(PLUGIN);

/**
 * SystemSettings — opens the phone's settings from the app (LumaSettingsPlugin.java, Android
 * only). Elsewhere `available` is false and the screen explains the steps in words.
 */
@Injectable({ providedIn: 'root' })
export class SystemSettings {
  public readonly available = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable(PLUGIN);

  /** The phone's location switch. */
  public async openLocation(): Promise<void> {
    await LumaSettings.openLocationSettings();
  }

  /** The permissions of this app. */
  public async openApp(): Promise<void> {
    await LumaSettings.openAppSettings();
  }
}

import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import type { LocationSource } from './location-source';
import { NativeLocationSource } from './native-location-source';
import { WebLocationSource } from './web-location-source';

/** The plugin inside the app, the browser on the web. */
export const LOCATION_SOURCE = new InjectionToken<LocationSource>('LOCATION_SOURCE', {
  providedIn: 'root',
  factory: () => (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Geolocation') ? new NativeLocationSource() : new WebLocationSource()),
});

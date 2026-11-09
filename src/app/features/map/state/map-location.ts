import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AppEvents } from '@core/native/app-events';
import { SystemSettings } from '@core/native/system-settings';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { MapCameraService } from '../services/map-camera.service';
import { ZoneLabel } from '../utils/zone-label';

/**
 * MapLocation — the location button of the map: explains before asking, reads after the
 * permission, says why when it could not, and tries again on returning from the phone's settings.
 */
@Injectable()
export class MapLocation {
  private readonly geo = inject(GeolocationService);
  private readonly camera = inject(MapCameraService);
  private readonly settings = inject(SystemSettings);
  private readonly resumes = inject(AppEvents).resumes;
  /** The user tapped "Permitir" and has not seen the outcome yet. */
  private readonly awaiting = signal(false);

  public readonly promptOpen = signal(false);
  public readonly state = this.geo.state;
  public readonly failure = this.geo.failure;
  public readonly zoneKey = computed(() => ZoneLabel.getZoneLabelKey(this.state(), this.failure()));
  public readonly canOpenSettings = computed(() => this.settings.available && (this.failure() === 'denied' || this.failure() === 'servicesOff'));

  constructor() {
    effect(() => {
      if (!this.awaiting() || this.state() === 'locating') return;
      untracked(() => {
        this.awaiting.set(false);
        if (this.failure()) this.promptOpen.set(true);
      });
    });
    effect(() => {
      if (this.geo.hasRealLocation()) untracked(() => this.promptOpen.set(false));
    });
    effect(() => {
      if (this.resumes() > 0 && untracked(this.failure)) void this.geo.requestIfAllowed();
    });
  }

  /** On opening the map: the position if it was already allowed; never asks. */
  public start(): void {
    void this.geo.requestIfAllowed();
  }

  /** The location button: centres on the position, or explains and asks. */
  public centre(): void {
    if (this.geo.hasRealLocation()) {
      const { lat, lng } = this.geo.coords();
      this.camera.flyTo(lat, lng);
    } else if (this.state() !== 'locating') {
      this.promptOpen.set(true);
    }
  }

  /** "Permitir" or "Reintentar": asks the system, then reads. */
  public allow(): void {
    this.promptOpen.set(false);
    this.awaiting.set(true);
    this.geo.requestLocation();
  }

  /** "Ahora no". */
  public skip(): void {
    this.promptOpen.set(false);
  }

  /** The app's permissions when refused; the phone's location when it is off. */
  public async openSettings(): Promise<void> {
    await (this.failure() === 'denied' ? this.settings.openApp() : this.settings.openLocation()).catch(() => undefined);
  }
}

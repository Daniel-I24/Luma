import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AppEvents } from '@core/native/app-events';
import { SystemSettings } from '@core/native/system-settings';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { DOCUMENT } from '@angular/common';
import { Haversine } from '@shared/geo/distance';
import { PASTO_CENTRE } from '@shared/geo/geolocation.service';
import { MapCameraService } from '../services/map-camera.service';
import { ZoneLabel, type ZoneText } from '../utils/zone-label';
import { MapZone } from './map-zone';

/** Farther than this from Pasto, an empty map means Luma is not there yet. */
const COVERAGE_KM = 40;

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
  private readonly zone = inject(MapZone);
  private readonly document = inject(DOCUMENT);
  private readonly visible = signal(!this.document.hidden);
  /** The user tapped "Permitir" and has not seen the outcome yet. */
  private readonly awaiting = signal(false);

  public readonly promptOpen = signal(false);
  public readonly state = this.geo.state;
  public readonly failure = this.geo.failure;
  /** The map shows somewhere else than the user: the label offers to go back. */
  public readonly canReturn = this.zone.browsing;
  public readonly zoneText = computed<ZoneText>(() => {
    if (this.geo.hasRealLocation()) return this.zone.label();
    const key = ZoneLabel.getZoneLabelKey(this.state(), this.failure());
    const town = this.geo.fallbackName();
    return key === 'map.zone.cityCentre' && town ? { key: 'map.zone.centreOf', params: { name: town } } : { key, params: {} };
  });
  /** The map is outside the area where Luma has businesses. */
  public readonly outsideCoverage = computed(() => {
    const { lat, lng } = this.camera.centre() ?? this.geo.coords();
    return Haversine.haversineKm(lat, lng, PASTO_CENTRE.lat, PASTO_CENTRE.lng) > COVERAGE_KM;
  });
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
    // The position stays current only while the map is on screen.
    effect((onCleanup) => {
      if (this.geo.hasRealLocation() && this.visible()) onCleanup(this.geo.follow());
    });
    const onVisibility = (): void => this.visible.set(!this.document.hidden);
    this.document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => this.document.removeEventListener('visibilitychange', onVisibility));
  }

  /** On opening the map: the position if it was already allowed; never asks. */
  public start(): void {
    void this.geo.requestIfAllowed();
  }

  /** The location button: centres on the position, or explains and asks. */
  public centre(): void {
    if (this.geo.hasRealLocation()) {
      this.zone.recentre();
    } else if (this.state() !== 'locating') {
      this.promptOpen.set(true);
    }
  }

  /** A new position: the map goes along when it should. */
  public follow(point: { lat: number; lng: number }): void {
    this.zone.follow(point);
  }

  /** "Explorar Pasto": the going-back option stays on the label. */
  public explorePasto(): void {
    this.camera.flyTo(PASTO_CENTRE.lat, PASTO_CENTRE.lng);
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

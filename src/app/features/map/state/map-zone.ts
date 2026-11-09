import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Haversine } from '@shared/geo/distance';
import { type GeoCoords, GeolocationService } from '@shared/geo/geolocation.service';
import { PlaceSearchRepository } from '@shared/geo/place-search.repository';
import { MapCameraService } from '../services/map-camera.service';
import type { ZoneText } from '../utils/zone-label';

/** A real move: the map follows and the name is looked up again, not on GPS jitter. */
const MOVE_KM = 0.2;
/** Above MOVE_KM: a move of the user alone never counts as having moved the map. */
const BROWSE_KM = 0.3;
/** About 110 m: never the exact position, and neighbours share the cached answer. */
const GRID = 1000;
const MAX_NAMES = 64;

const km = (a: GeoCoords, b: GeoCoords): number => Haversine.haversineKm(a.lat, a.lng, b.lat, b.lng);

/**
 * MapZone — the name of the zone on screen, for a user with a real position: where they are
 * or, once they move the map away, the centre of the map. Reverse geocoding on a rounded
 * point, remembered here and by the geocode function.
 */
@Injectable()
export class MapZone {
  private readonly geo = inject(GeolocationService);
  private readonly camera = inject(MapCameraService);
  private readonly places = inject(PlaceSearchRepository);
  private readonly names = new Map<string, string | null>();
  private readonly name = signal<string | null>(null);
  /** Where the app last put the camera for the user. */
  private readonly centredOn = signal<GeoCoords | null>(null);
  private namedAt: GeoCoords | null = null;
  private ticket = 0;

  /** The map was moved away from the user. */
  public readonly browsing = computed(() => {
    const centre = this.camera.centre();
    const mine = this.centredOn();
    return this.geo.hasRealLocation() && !!centre && !!mine && km(centre, mine) > BROWSE_KM;
  });

  public readonly label = computed((): ZoneText => {
    const name = this.name();
    if (this.browsing()) return name ? { key: 'map.zone.viewing', params: { name } } : { key: 'map.zone.viewingMap', params: {} };
    return name ? { key: 'map.zone.at', params: { name } } : { key: 'map.zone.nearYou', params: {} };
  });

  private readonly focus = computed(() => {
    if (!this.geo.hasRealLocation()) return null;
    return this.browsing() ? this.camera.centre() : this.geo.coords();
  });

  constructor() {
    effect(() => {
      const point = this.focus();
      if (point) untracked(() => void this.describe(point));
    });
  }

  /** A new reading: the map goes along unless the user took it elsewhere, or it is only jitter. */
  public follow(point: GeoCoords): void {
    const last = this.centredOn();
    if (last && (this.browsing() || km(last, point) < MOVE_KM)) return;
    this.flyTo(point);
  }

  /** Back to the user's position. */
  public recentre(): void {
    this.flyTo(this.geo.coords());
  }

  private flyTo(point: GeoCoords): void {
    this.centredOn.set(point);
    this.camera.flyTo(point.lat, point.lng);
  }

  private async describe(point: GeoCoords): Promise<void> {
    if (this.namedAt && km(this.namedAt, point) < MOVE_KM) return;
    this.namedAt = point;
    const ticket = ++this.ticket;
    const name = await this.lookUp({ lat: Math.round(point.lat * GRID) / GRID, lng: Math.round(point.lng * GRID) / GRID });
    if (ticket === this.ticket) this.name.set(name);
  }

  private async lookUp(rounded: GeoCoords): Promise<string | null> {
    const key = `${rounded.lat},${rounded.lng}`;
    if (this.names.has(key)) return this.names.get(key) ?? null;
    const { address, errorKey } = await this.places.reverse(rounded);
    const name = address?.neighbourhood ?? address?.city ?? null;
    // A failure is not an answer: the next move asks again.
    if (!errorKey) this.remember(key, name);
    return name;
  }

  private remember(key: string, name: string | null): void {
    if (this.names.size >= MAX_NAMES) this.names.delete(this.names.keys().next().value as string);
    this.names.set(key, name);
  }
}

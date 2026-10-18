import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import * as maplibregl from 'maplibre-gl';
import { LumaButton } from '@design-system';
import { type GeoCoords, GeolocationService, PASTO_CENTRE } from '@shared/geo/geolocation.service';
import { createBaseMap } from '@shared/map/map-base';
import { MapStylesLoader } from '@shared/map/map-styles.loader';

const PICKER_ZOOM = 16;

/**
 * LocationPicker — tap the map (or drag the pin) to choose a business
 * location; starts at the chosen point or the centre of Pasto. Keyboard and
 * screen reader users can pan the map with the arrows and pin its centre, or
 * use their current location.
 */
@Component({
  selector: 'app-location-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton],
  templateUrl: './location-picker.html',
})
export class LocationPicker {
  private readonly geo = inject(GeolocationService);
  private readonly styles = inject(MapStylesLoader);
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('map');

  readonly pickerId = input.required<string>();
  readonly errorMessage = input<string | undefined>(undefined);
  readonly position = model<GeoCoords | null>(null);

  protected readonly mapFailed = signal(false);
  protected readonly locating = signal(false);
  protected readonly geoState = this.geo.state;
  private map: maplibregl.Map | null = null;
  private marker: maplibregl.Marker | null = null;

  constructor() {
    afterNextRender(() => this.initMap());
    effect(() => {
      const position = this.position();
      untracked(() => this.syncMarker(position));
    });
    effect(() => {
      if (!this.locating() || this.geo.state() === 'locating') return;
      untracked(() => {
        this.locating.set(false);
        if (this.geo.state() === 'granted') this.place(this.geo.coords(), true);
      });
    });
    inject(DestroyRef).onDestroy(() => this.map?.remove());
  }

  protected useCurrentLocation(): void {
    this.locating.set(true);
    this.geo.requestLocation();
  }

  protected useMapCentre(): void {
    const centre = this.map?.getCenter();
    if (centre) this.place({ lat: centre.lat, lng: centre.lng }, false);
  }

  protected format(value: number): string {
    return value.toFixed(5);
  }

  private initMap(): void {
    try {
      this.styles.ensureLoaded();
      const start = this.position() ?? PASTO_CENTRE;
      this.map = createBaseMap(this.container().nativeElement, start, PICKER_ZOOM);
      this.map.on('click', (event) =>
        this.place({ lat: event.lngLat.lat, lng: event.lngLat.lng }, false),
      );
      this.syncMarker(this.position());
    } catch {
      this.mapFailed.set(true);
    }
  }

  private place(coords: GeoCoords, recentre: boolean): void {
    this.position.set({ lat: coords.lat, lng: coords.lng });
    if (recentre) this.map?.easeTo({ center: [coords.lng, coords.lat] });
  }

  private syncMarker(position: GeoCoords | null): void {
    if (!this.map || !position) return;
    if (!this.marker) {
      const element = document.createElement('div');
      element.className = 'luma-marker luma-marker--picked';
      element.setAttribute('aria-hidden', 'true');
      element.appendChild(document.createElement('span')).className = 'luma-marker__pin';
      this.marker = new maplibregl.Marker({ element, draggable: true, anchor: 'bottom' });
      this.marker.on('dragend', () => {
        const at = this.marker?.getLngLat();
        if (at) this.position.set({ lat: at.lat, lng: at.lng });
      });
      this.marker.setLngLat([position.lng, position.lat]).addTo(this.map);
      return;
    }
    this.marker.setLngLat([position.lng, position.lat]);
  }
}

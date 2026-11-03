import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, type ElementRef, computed, effect, inject, input, signal, untracked,
  viewChild,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import * as maplibregl from 'maplibre-gl';
import { ExternalUrls } from '@core/config/external-urls';
import { LumaIcon } from '@design-system';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { BaseMap } from '@shared/map/map-base';
import { MapStylesLoader } from '@shared/map/map-styles.loader';
import { type LatLng, RouteRepository, type TravelRoute } from '../route.repository';
import { TRAVEL_MODES, type TravelMode, TravelModePreference } from '../travel-modes';

const SOURCE = 'luma-route';
const ZOOM = 15;
const SECONDS_PER_MINUTE = 60;
const METERS_PER_KM = 1000;
/** Room around the route when the map fits it (CSS px, a MapLibre option). */
const FIT_PADDING = 48;

/**
 * RouteMap — "Cómo llegar" inside the app: the route drawn on Luma's own
 * map from the customer to the business, with distance and time on foot, by
 * bike, motorcycle or car (icon buttons; the last mode is remembered). Without the customer's location it asks for it; without a
 * routing key the line is straight and the time estimated. "Abrir en Google
 * Maps" stays as a secondary way.
 */
@Component({
  selector: 'app-route-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIcon],
  templateUrl: './route-map.html',
})
export class RouteMap {
  private readonly geo = inject(GeolocationService);
  private readonly routes = inject(RouteRepository);
  private readonly styles = inject(MapStylesLoader);
  private readonly document = inject(DOCUMENT);
  private readonly preference = inject(TravelModePreference);
  private readonly container = viewChild<ElementRef<HTMLElement>>('map');

  public readonly lat = input.required<number>();
  public readonly lng = input.required<number>();
  private readonly destination = computed<LatLng>(() => ({ lat: this.lat(), lng: this.lng() }), {
    equal: (a, b) => a.lat === b.lat && a.lng === b.lng,
  });
  public readonly name = input.required<string>();

  protected readonly modes = TRAVEL_MODES;
  protected readonly mode = signal<TravelMode>(this.preference.read());
  protected readonly route = signal<TravelRoute | null>(null);
  protected readonly failed = signal(false);
  protected readonly located = this.geo.hasRealLocation;
  protected readonly minutes = computed(() => Math.max(1, Math.round((this.route()?.durationS ?? 0) / SECONDS_PER_MINUTE)));
  protected readonly km = computed(() => ((this.route()?.distanceM ?? 0) / METERS_PER_KM).toFixed(1));
  protected readonly googleMaps = computed(() => {
    const { lat, lng } = this.destination();
    return ExternalUrls.directions(`${lat},${lng}`);
  });
  private map: maplibregl.Map | null = null;

  constructor() {
    effect(() => {
      const mode = this.mode();
      const to = this.destination();
      const from = this.located() ? this.geo.coords() : null;
      if (from) untracked(() => void this.load(from, to, mode));
    });
    inject(DestroyRef).onDestroy(() => this.map?.remove());
  }

  protected choose(mode: TravelMode): void {
    this.mode.set(mode);
    this.preference.write(mode);
  }

  protected locate(): void {
    this.geo.requestLocation();
  }

  private async load(from: LatLng, to: LatLng, mode: TravelMode): Promise<void> {
    const route = await this.routes.route(from, to, mode);
    this.route.set(route);
    this.draw(route, from, to);
  }

  private draw(route: TravelRoute, from: LatLng, to: LatLng): void {
    const element = this.container()?.nativeElement;
    if (!element) return;
    try {
      this.styles.ensureLoaded();
      this.map ??= BaseMap.createBaseMap(element, to, ZOOM);
      const map = this.map;
      const show = (): void => {
        const data = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: route.line.map(([lng, lat]) => [lng, lat]) } };
        const source = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
        if (source) source.setData(data);
        else {
          map.addSource(SOURCE, { type: 'geojson', data });
          map.addLayer({ id: SOURCE, type: 'line', source: SOURCE, paint: { 'line-color': this.token('--color-primary'), 'line-width': 5 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
          new maplibregl.Marker().setLngLat([from.lng, from.lat]).addTo(map);
          new maplibregl.Marker().setLngLat([to.lng, to.lat]).addTo(map);
        }
        const bounds = route.line.reduce((b, [lng, lat]) => b.extend([lng, lat]), new maplibregl.LngLatBounds([...route.line[0]], [...route.line[0]]));
        map.fitBounds(bounds, { padding: FIT_PADDING, animate: !this.reducedMotion() });
      };
      if (map.isStyleLoaded()) show();
      else map.once('load', show);
    } catch {
      this.failed.set(true);
    }
  }

  /** MapLibre paints with a colour string: the theme token, read at run time. */
  private token(name: string): string {
    return this.document.defaultView?.getComputedStyle(this.document.documentElement).getPropertyValue(name).trim() || 'currentColor';
  }

  private reducedMotion(): boolean {
    return this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }
}

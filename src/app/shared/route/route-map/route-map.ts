import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, type ElementRef, afterNextRender, computed, effect, inject, input, signal,
  untracked, viewChild,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ExternalUrls } from '@core/config/external-urls';
import { LumaIcon } from '@design-system';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { MapStylesLoader } from '@shared/map/map-styles.loader';
import { type LatLng, RouteRepository, type TravelRoute } from '../route.repository';
import { TRAVEL_MODES, type TravelMode, TravelModePreference } from '../travel-modes';
import { RouteDrawing } from './route-drawing';

const SECONDS_PER_MINUTE = 60;
const METERS_PER_KM = 1000;

/**
 * RouteMap — "Cómo llegar" inside the app: Luma's own map with the
 * business pin from the start; with the customer's location, the route
 * from there with distance and time on foot, by bike, motorcycle or car
 * (icon buttons; the last mode is remembered). Without the location the map
 * still shows the pin and offers "Activar ubicación"; without a routing key
 * the line is straight and the time estimated. "Abrir en Google Maps" stays
 * as a secondary way.
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
  protected readonly osmCopyright = ExternalUrls.OSM_COPYRIGHT;
  protected readonly osmFix = ExternalUrls.OSM_FIX_THE_MAP;
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
  private drawing: RouteDrawing | null = null;

  constructor() {
    afterNextRender(() => this.start());
    effect(() => {
      const mode = this.mode();
      const to = this.destination();
      const from = this.located() ? this.geo.coords() : null;
      if (from) untracked(() => void this.load(from, to, mode));
    });
    inject(DestroyRef).onDestroy(() => this.drawing?.remove());
  }

  protected choose(mode: TravelMode): void {
    this.mode.set(mode);
    this.preference.write(mode);
  }

  protected locate(): void {
    this.geo.requestLocation();
  }

  /** "Cómo llegar": frames the route, or asks for the location first. */
  protected directions(): void {
    if (this.located()) this.drawing?.fit();
    else this.locate();
  }

  private async load(from: LatLng, to: LatLng, mode: TravelMode): Promise<void> {
    const route = await this.routes.route(from, to, mode);
    this.route.set(route);
    this.start();
    this.drawing?.show(route, from);
  }

  /** The map with the business pin; the route is drawn on it later. */
  private start(): void {
    const element = this.container()?.nativeElement;
    if (!element || this.drawing || this.failed()) return;
    try {
      this.styles.ensureLoaded();
      this.drawing = new RouteDrawing(element, this.destination(), { color: this.token('--color-primary'), animate: !this.reducedMotion() });
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

import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, type ElementRef, afterNextRender, computed, effect, inject, input, signal,
  untracked, viewChild,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ExternalUrls } from '@core/config/external-urls';
import { ExternalMaps } from '@core/native/external-maps';
import { LumaIcon } from '@design-system';
import { Haversine } from '@shared/geo/distance';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { MapStylesLoader } from '@shared/map/map-styles.loader';
import { type LatLng, RouteRepository, type TravelRoute } from '../route.repository';
import { TRAVEL_MODES, type TravelMode, TravelModePreference } from '../travel-modes';
import { RouteDrawing } from './route-drawing';
import { RouteMapEnv } from './route-map-env';

const SECONDS_PER_MINUTE = 60;
const METERS_PER_KM = 1000;
/** Less than this is GPS noise: each new route uses the customer's daily quota. */
const MIN_MOVE_KM = 0.05;

/**
 * RouteMap — "Cómo llegar" in the app: the business pin from the start; with the
 * customer's location, the route by streets with distance and time per mode, redrawn
 * when they move. The button draws it or opens the phone's navigation. The straight
 * line is the last resort, shown as an estimate.
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
  private readonly maps = inject(ExternalMaps);
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
  protected readonly tracing = signal(false);
  protected readonly located = this.geo.hasRealLocation;
  /** Without permission or GPS: the button goes straight to the phone's navigation. */
  protected readonly noLocation = computed(() => this.geo.state() === 'denied' || this.geo.state() === 'unavailable');
  protected readonly minutes = computed(() => Math.max(1, Math.round((this.route()?.durationS ?? 0) / SECONDS_PER_MINUTE)));
  protected readonly km = computed(() => ((this.route()?.distanceM ?? 0) / METERS_PER_KM).toFixed(1));
  protected readonly googleMaps = computed(() =>
    ExternalUrls.directions(`${this.lat()},${this.lng()}`, TravelModePreference.info(this.mode()).google),
  );
  /** Where the route starts: it only changes after a real move. */
  private readonly origin = computed<LatLng | null>(() => (this.located() ? this.geo.coords() : null), {
    equal: (a, b) => a === b || (!!a && !!b && Haversine.haversineKm(a.lat, a.lng, b.lat, b.lng) < MIN_MOVE_KM),
  });
  private drawing: RouteDrawing | null = null;
  private ticket = 0;

  constructor() {
    afterNextRender(() => {
      this.start();
      void this.geo.requestIfAllowed();
    });
    effect((onCleanup) => {
      if (this.located()) onCleanup(this.geo.follow());
    });
    effect(() => {
      const mode = this.mode();
      const to = this.destination();
      const from = this.origin();
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

  /** "Cómo llegar": the route by streets here; otherwise the phone's navigation. */
  protected async directions(): Promise<void> {
    if (this.noLocation() || this.failed()) return this.navigate();
    const from = this.origin();
    if (!from) return this.locate();
    if (await this.hasStreets(from)) this.drawing?.reveal();
    else await this.navigate();
  }

  /** A route by streets, already here or asked for again. */
  private async hasStreets(from: LatLng): Promise<boolean> {
    if (this.route() && this.route()?.source !== 'straight') return true;
    this.tracing.set(true);
    const route = await this.load(from, this.destination(), this.mode());
    this.tracing.set(false);
    return !!route && route.source !== 'straight';
  }

  protected openGoogleMaps(event: Event): void {
    event.preventDefault();
    void this.maps.open(this.googleMaps());
  }

  private navigate(): Promise<void> {
    return this.maps.navigate(this.lat(), this.lng(), this.name());
  }

  /** An answer that arrives after a newer request is dropped. */
  private async load(from: LatLng, to: LatLng, mode: TravelMode): Promise<TravelRoute | null> {
    const ticket = ++this.ticket;
    const route = await this.routes.route(from, to, mode);
    if (ticket !== this.ticket) return null;
    this.route.set(route);
    this.start();
    this.drawing?.show(route, from);
    return route;
  }

  /** The map with the business pin; the route is drawn on it later. */
  private start(): void {
    const element = this.container()?.nativeElement;
    if (!element || this.drawing || this.failed()) return;
    try {
      this.styles.ensureLoaded();
      const color = RouteMapEnv.token(this.document, '--color-primary');
      this.drawing = new RouteDrawing(element, this.destination(), { color, animate: !RouteMapEnv.reducedMotion(this.document) });
    } catch {
      this.failed.set(true);
    }
  }
}

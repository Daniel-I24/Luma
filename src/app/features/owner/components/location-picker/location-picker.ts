import {
  ChangeDetectionStrategy, Component, DestroyRef, type ElementRef, afterNextRender, computed, effect, inject, input, model,
  signal, untracked, viewChild,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaNotice } from '@design-system';
import { type GeoCoords, GeolocationService, PASTO_CENTRE } from '@shared/geo/geolocation.service';
import { type Candidate, LocationChecks } from './location-checks';
import { LocationSearch } from './location-search';
import { type PickerMap, PickerMapFactory } from './picker-map';

/** About one metre. */
const COORDINATE_DECIMALS = 5;

/**
 * LocationPicker — the pin stays fixed at the centre and the map moves
 * under it (the pin lifts while dragging and drops on release). Three ways
 * in: "Estoy en el local" (GPS, with its accuracy), "Buscar" (moves the map,
 * never confirms) and moving the map. Only "Confirmar este punto" sets
 * `position`. Warnings: far from the municipality, or on another business
 * of the owner (docs/location.md).
 */
@Component({
  selector: 'app-location-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaNotice, TranslocoModule, LumaButton, LocationSearch],
  templateUrl: './location-picker.html',
  styleUrls: ['./location-picker.css'],
})
export class LocationPicker {
  private readonly geo = inject(GeolocationService);
  private readonly maps = inject(PickerMapFactory);
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('map');

  public readonly pickerId = input.required<string>();
  public readonly errorMessage = input<string | undefined>(undefined);
  /** Centre of the chosen municipality (DANE). */
  public readonly centre = input<GeoCoords | null>(null);
  /** The owner's other businesses. */
  public readonly others = input<readonly GeoCoords[]>([]);
  /** The confirmed point. */
  public readonly position = model<GeoCoords | null>(null);

  protected readonly mapFailed = signal(false);
  protected readonly lifted = signal(false);
  protected readonly locating = signal(false);
  /** Where the pin points now (confirmed or not). */
  protected readonly pending = signal<GeoCoords | null>(null);
  protected readonly fallback = PASTO_CENTRE;
  protected readonly geoState = this.geo.state;
  protected readonly accuracy = this.geo.accuracy;
  protected readonly unconfirmed = computed(() => {
    const at = this.pending();
    const confirmed = this.position();
    return !!at && (!confirmed || this.format(at.lat) !== this.format(confirmed.lat) || this.format(at.lng) !== this.format(confirmed.lng));
  });
  protected readonly warnings = computed(() => {
    const at = this.position();
    return at ? LocationChecks.warnings(at, this.centre(), this.others()) : [];
  });
  private map: PickerMap | null = null;

  constructor() {
    afterNextRender(() => this.initMap());
    effect(() => {
      if (!this.locating() || this.geo.state() === 'locating') return;
      untracked(() => {
        this.locating.set(false);
        if (this.geo.state() === 'granted') this.moveTo(this.geo.coords());
      });
    });
    inject(DestroyRef).onDestroy(() => this.map?.remove());
  }

  /** "Estoy en el local": a fresh GPS fix; the map moves there, the owner confirms. */
  protected locate(): void {
    this.locating.set(true);
    this.geo.requestLocation(true);
  }

  protected preview(candidate: Candidate): void {
    this.moveTo(candidate);
  }

  protected confirm(): void {
    const at = this.pending();
    if (at) this.position.set({ lat: Number(this.format(at.lat)), lng: Number(this.format(at.lng)) });
  }

  protected format(value: number): string {
    return value.toFixed(COORDINATE_DECIMALS);
  }

  private moveTo(point: GeoCoords): void {
    this.pending.set({ lat: point.lat, lng: point.lng });
    this.map?.moveTo(point);
  }

  private initMap(): void {
    const start = this.position() ?? this.centre() ?? PASTO_CENTRE;
    this.pending.set(start);
    try {
      this.map = this.maps.create(this.container().nativeElement, start);
      this.map.onMove(
        () => this.lifted.set(true),
        (centre) => {
          this.lifted.set(false);
          this.pending.set(centre);
        },
      );
    } catch {
      this.mapFailed.set(true);
    }
  }
}

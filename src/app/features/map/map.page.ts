import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaButton, LumaEmptyState, STATUS_LABEL_KEY } from '@design-system';
import { BusinessSheetComponent } from './components/business-sheet/business-sheet.component';
import { LocationPrompt } from './components/location-prompt/location-prompt';
import { MapControls } from './components/map-controls/map-controls';
import { MapTopBar } from './components/map-top-bar/map-top-bar';
import { NearbyPanel } from './components/nearby-panel/nearby-panel';
import { GeolocationService, PASTO_CENTRE } from './services/geolocation.service';
import { MapCameraService } from './services/map-camera.service';
import { MapMarkerSyncService } from './services/map-marker-sync.service';
import { MapStylesLoader } from './services/map-styles.loader';
import { BusinessSelectionStore } from './state/business-selection.store';
import { NearbyBusinessesStore } from './state/nearby-businesses.store';
import { getZoneLabelKey } from './utils/zone-label.util';

/** MapPage — /map: live map, filters, nearby businesses and the business sheet. */
@Component({
  selector: 'app-map-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaButton,
    LumaEmptyState,
    BusinessSheetComponent,
    LocationPrompt,
    MapControls,
    MapTopBar,
    NearbyPanel,
  ],
  providers: [NearbyBusinessesStore, BusinessSelectionStore],
  templateUrl: './map.page.html',
  host: { class: 'block h-full' },
})
export class MapPage implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  protected readonly store = inject(NearbyBusinessesStore);
  protected readonly selection = inject(BusinessSelectionStore);
  protected readonly camera = inject(MapCameraService);
  private readonly markerSync = inject(MapMarkerSyncService);
  private readonly geo = inject(GeolocationService);
  private readonly styles = inject(MapStylesLoader);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly lang = toSignal(this.transloco.langChanges$);

  private readonly mapReady = signal(false);
  protected readonly mapFailed = signal(false);
  protected readonly showLocationPrompt = signal(false);
  protected readonly zoneKey = computed(() => getZoneLabelKey(this.geo.state()));

  constructor() {
    // Markers follow the filtered list and the active language.
    effect(() => {
      const items = this.store.items();
      this.lang();
      if (!this.mapReady()) return;
      const markers = items.map(({ business, status }) => ({
        business,
        status,
        label: `${business.name}, ${this.transloco.translate(STATUS_LABEL_KEY[status])}`,
      }));
      this.markerSync.syncMarkers(this.camera.instance, markers, (biz) => this.openById(biz.id));
    });
    // Once the user shares their location, show it and centre the map there.
    effect(() => {
      if (!this.mapReady() || !this.geo.hasRealLocation()) return;
      const { lat, lng } = this.geo.coords();
      this.camera.showUser(lat, lng);
      this.camera.flyTo(lat, lng);
    });
  }

  ngOnInit(): void {
    this.styles.ensureLoaded();
    this.startMap();
  }

  ngOnDestroy(): void {
    this.markerSync.clear();
    if (this.mapReady()) this.camera.destroy();
  }

  /** Starts MapLibre; on failure shows the error state instead of a blank map. */
  protected startMap(): void {
    try {
      this.camera.init(this.mapContainer.nativeElement, (lat, lng) => this.load(lat, lng));
      this.mapFailed.set(false);
      this.mapReady.set(true);
      this.load(PASTO_CENTRE.lat, PASTO_CENTRE.lng);
    } catch {
      this.mapFailed.set(true);
    }
  }

  protected reload(): void {
    const { lat, lng } = this.camera.currentCenter();
    this.load(lat, lng);
  }

  protected onCentreOnMe(): void {
    if (!this.geo.hasRealLocation()) {
      this.showLocationPrompt.set(true);
      return;
    }
    const { lat, lng } = this.geo.coords();
    this.camera.flyTo(lat, lng);
  }

  protected onAllowLocation(): void {
    this.showLocationPrompt.set(false);
    this.geo.requestLocation();
  }

  protected openAi(): void {
    void this.router.navigate(['/ai']);
  }

  private openById(id: string): void {
    const item = this.store.items().find((i) => i.business.id === id);
    if (item) void this.selection.select(item);
  }

  private load(lat: number, lng: number): void {
    this.camera.markFetched(lat, lng);
    void this.store.load(lat, lng);
  }
}

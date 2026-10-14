import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
  computed,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton } from '@design-system';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { BusinessSheetComponent } from './components/business-sheet/business-sheet.component';
import { BusinessHoursCacheService } from './services/business-hours-cache.service';
import { MapCameraService } from './services/map-camera.service';
import { MapMarkerSyncService } from './services/map-marker-sync.service';
import { GeolocationService, PASTO_CENTRE } from './services/geolocation.service';
import { haversineKm } from './utils/haversine.util';
import { NEARBY_RADIUS_KM } from './map.constants';
import type { Business, BusinessHours, Promotion } from '@shared/business/models/business.model';

@Component({
  selector: 'app-map-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, BusinessSheetComponent],
  templateUrl: './map.page.html',
  styleUrl: './map.page.css',
})
export class MapPage implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private readonly repo = inject(BusinessRepository);
  private readonly hoursCache = inject(BusinessHoursCacheService);
  private readonly camera = inject(MapCameraService);
  private readonly markerSync = inject(MapMarkerSyncService);
  private readonly geoService = inject(GeolocationService);

  protected readonly loading = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly showLocationPrompt = signal(false);
  protected readonly selectedBusiness = signal<Business | null>(null);
  protected readonly selectedHours = signal<BusinessHours[]>([]);
  protected readonly selectedPromotion = signal<Promotion | null>(null);
  protected readonly sheetOpen = signal(false);
  protected readonly distanceKm = computed(() => {
    const b = this.selectedBusiness();
    const c = this.geoService.coords();
    if (!b || !this.geoService.hasRealLocation()) return null;
    return haversineKm(c.lat, c.lng, b.latitude, b.longitude);
  });

  ngOnInit(): void {
    this.camera.init(this.mapContainer.nativeElement, (lat, lng) => this.loadNearby(lat, lng));
    this.loadNearby(PASTO_CENTRE.lat, PASTO_CENTRE.lng);
  }

  ngOnDestroy(): void {
    this.markerSync.clear();
    this.camera.destroy();
  }

  protected onCentreOnMe(): void {
    if (this.geoService.hasRealLocation()) {
      const c = this.geoService.coords();
      this.camera.flyTo(c.lat, c.lng);
    } else {
      this.showLocationPrompt.set(true);
    }
  }

  protected onAllowLocation(): void {
    this.showLocationPrompt.set(false);
    this.geoService.requestLocation();
  }

  protected onSkipLocation(): void {
    this.showLocationPrompt.set(false);
  }

  protected onSheetClosed(): void {
    this.sheetOpen.set(false);
  }

  protected retryLoad(): void {
    this.errorKey.set(null);
    const c = this.camera.currentCenter();
    this.loadNearby(c.lat, c.lng);
  }

  private async loadNearby(lat: number, lng: number): Promise<void> {
    this.loading.set(true);
    this.errorKey.set(null);
    this.camera.markFetched(lat, lng);

    const result = await this.repo.getNearby(lat, lng, NEARBY_RADIUS_KM);
    this.loading.set(false);
    if (result.errorKey || !result.data) {
      this.errorKey.set(result.errorKey ?? 'map.errorLoading');
      return;
    }

    await this.hoursCache.prefetch(result.data.map((b) => b.id));
    this.syncMarkers(result.data);
  }

  private syncMarkers(businesses: Business[]): void {
    this.markerSync.syncMarkers(
      this.camera.instance,
      businesses,
      this.hoursCache.snapshot(),
      (biz) => {
        void this.onMarkerClick(biz);
      },
    );
  }

  private async onMarkerClick(biz: Business): Promise<void> {
    this.selectedBusiness.set(biz);
    this.selectedHours.set(this.hoursCache.get(biz.id));
    this.selectedPromotion.set(null);
    this.sheetOpen.set(true);

    const promoResult = await this.repo.getActivePromotions(biz.id);
    this.selectedPromotion.set(promoResult.data?.[0] ?? null);
  }
}

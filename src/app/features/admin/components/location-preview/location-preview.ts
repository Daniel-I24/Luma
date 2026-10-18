import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import * as maplibregl from 'maplibre-gl';
import { createBaseMap } from '@shared/map/map-base';
import { MapStylesLoader } from '@shared/map/map-styles.loader';

const PREVIEW_ZOOM = 16;

/** LocationPreview — read-only map with the business pin, for the review. */
@Component({
  selector: 'app-location-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  template: `
    <div *transloco="let t" class="flex flex-col gap-1">
      <div
        #map
        class="h-48 w-full overflow-hidden rounded-lg border border-border bg-map-canvas"
        role="img"
        [attr.aria-label]="t('admin.review.mapLabel', { lat: lat().toFixed(5), lng: lng().toFixed(5) })"
      ></div>
      @if (failed()) {
        <p class="m-0 text-caption text-fg-muted">{{ t('businessPanel.location.mapFailed') }}</p>
      }
    </div>
  `,
})
export class LocationPreview {
  private readonly styles = inject(MapStylesLoader);
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('map');

  readonly lat = input.required<number>();
  readonly lng = input.required<number>();
  protected readonly failed = signal(false);
  private map: maplibregl.Map | null = null;

  constructor() {
    afterNextRender(() => {
      try {
        this.styles.ensureLoaded();
        const centre = { lat: this.lat(), lng: this.lng() };
        this.map = createBaseMap(this.container().nativeElement, centre, PREVIEW_ZOOM);
        this.map.scrollZoom.disable();
        new maplibregl.Marker().setLngLat([centre.lng, centre.lat]).addTo(this.map);
      } catch {
        this.failed.set(true);
      }
    });
    inject(DestroyRef).onDestroy(() => this.map?.remove());
  }
}

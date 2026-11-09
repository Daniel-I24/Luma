import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIconButton, type IconButtonVariant } from '@design-system';
import type { GeoState } from '@shared/geo/geolocation.service';

const LOCATE_VARIANT: Record<GeoState, IconButtonVariant> = {
  idle: 'surface',
  locating: 'ghost',
  granted: 'primary',
  denied: 'warning',
  unavailable: 'warning',
};

const LOCATE_LABEL: Record<GeoState, string> = {
  idle: 'map.centerOnMe',
  locating: 'map.locate.locating',
  granted: 'map.centerOnMe',
  denied: 'map.locate.failed',
  unavailable: 'map.locate.failed',
};

/** MapControls — locate and zoom buttons floating over the map; locate shows the real state. */
@Component({
  selector: 'app-map-controls',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIconButton],
  template: `
    <ng-container *transloco="let t">
      <app-luma-icon-button
        icon="locate"
        [variant]="locateVariant()"
        [label]="t(locateLabel())"
        [disabled]="state() === 'locating'"
        (clicked)="locate.emit()"
      />
      <app-luma-icon-button icon="plus" [label]="t('map.controls.zoomIn')" (clicked)="zoomIn.emit()" />
      <app-luma-icon-button
        icon="minus"
        [label]="t('map.controls.zoomOut')"
        (clicked)="zoomOut.emit()"
      />
    </ng-container>
  `,
  // A row at the bottom: a column reached the filter row on phones with a short map.
  host: { class: 'absolute end-[calc(var(--spacing-3)+env(safe-area-inset-right))] bottom-3 z-20 flex gap-2' },
})
export class MapControls {
  public readonly state = input<GeoState>('idle');

  public readonly locate = output<void>();
  public readonly zoomIn = output<void>();
  public readonly zoomOut = output<void>();

  protected readonly locateVariant = computed(() => LOCATE_VARIANT[this.state()]);
  protected readonly locateLabel = computed(() => LOCATE_LABEL[this.state()]);
}

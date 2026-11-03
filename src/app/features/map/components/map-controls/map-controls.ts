import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIconButton } from '@design-system';

/** MapControls — locate and zoom buttons floating over the map. */
@Component({
  selector: 'app-map-controls',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIconButton],
  template: `
    <ng-container *transloco="let t">
      <app-luma-icon-button icon="locate" [label]="t('map.centerOnMe')" (clicked)="locate.emit()" />
      <app-luma-icon-button icon="plus" [label]="t('map.controls.zoomIn')" (clicked)="zoomIn.emit()" />
      <app-luma-icon-button
        icon="minus"
        [label]="t('map.controls.zoomOut')"
        (clicked)="zoomOut.emit()"
      />
    </ng-container>
  `,
  host: { class: 'absolute right-3 bottom-3 z-20 flex flex-col gap-2' },
})
export class MapControls {
  public readonly locate = output<void>();
  public readonly zoomIn = output<void>();
  public readonly zoomOut = output<void>();
}

import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIconButton } from '@design-system';

/** MapControls — locate and zoom buttons floating over the map. */
@Component({
  selector: 'app-map-controls',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIconButton],
  templateUrl: './map-controls.html',
  host: { class: 'absolute right-3 bottom-3 z-20 flex flex-col gap-2' },
})
export class MapControls {
  readonly locate = output<void>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
}

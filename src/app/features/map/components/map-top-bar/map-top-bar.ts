import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIcon, LumaSearchInput } from '@design-system';
import { MapFilterBar } from '../map-filter-bar/map-filter-bar';

/**
 * MapTopBar — floating controls over the map: search box, zone indicator
 * and the filters (button, active chips and sheet).
 */
@Component({
  selector: 'app-map-top-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIcon, LumaSearchInput, MapFilterBar],
  templateUrl: './map-top-bar.html',
  host: {
    class:
      'pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 pt-[calc(env(safe-area-inset-top)+var(--spacing-3))]',
  },
})
export class MapTopBar {
  /** i18n key of the zone indicator. */
  readonly zoneKey = input.required<string>();

  readonly query = model('');
}

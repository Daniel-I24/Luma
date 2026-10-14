import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaChip, LumaIcon, LumaSearchInput } from '@design-system';

/**
 * MapTopBar — floating controls over the map: search box, zone indicator
 * and category chips taken from the loaded businesses.
 */
@Component({
  selector: 'app-map-top-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaChip, LumaIcon, LumaSearchInput],
  templateUrl: './map-top-bar.html',
  host: {
    class:
      'pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 pt-[calc(env(safe-area-inset-top)+var(--spacing-3))]',
  },
})
export class MapTopBar {
  readonly categories = input.required<readonly string[]>();
  /** i18n key of the zone indicator. */
  readonly zoneKey = input.required<string>();

  readonly query = model('');
  readonly category = model<string | null>(null);

  protected toggleCategory(category: string, selected: boolean): void {
    this.category.set(selected ? category : null);
  }
}

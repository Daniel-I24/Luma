import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaChip } from '@design-system';

/** PreviewChipsRow — shows every LumaChip variant and state in the design preview. */
@Component({
  selector: 'app-preview-chips-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaChip],
  templateUrl: './preview-chips-row.html',
  host: { class: 'flex flex-wrap items-center gap-3' },
})
export class PreviewChipsRow {
  protected readonly chipSelected = signal(false);
}

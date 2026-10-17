import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaEmptyState, LumaSkeleton } from '@design-system';
import type { PanelState } from '../../state/panel-business.store';

/** PanelStateView — loading skeleton, not found and error states; content when ready. */
@Component({
  selector: 'app-panel-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaEmptyState, LumaSkeleton],
  templateUrl: './panel-state.html',
})
export class PanelStateView {
  readonly state = input.required<PanelState>();
  readonly retry = output<void>();
}

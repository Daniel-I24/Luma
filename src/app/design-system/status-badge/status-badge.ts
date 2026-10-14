import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

export type BusinessStatus = 'open' | 'closed' | 'opening-soon' | 'closing-soon';

const STATUS_LABEL_KEY: Record<BusinessStatus, string> = {
  open: 'status.open',
  closed: 'status.closed',
  'opening-soon': 'status.openingSoon',
  'closing-soon': 'status.closingSoon',
};

/**
 * StatusBadge — displays the operational status of a business with its
 * translated label (status.*).
 *
 * Maps to the --color-status-* design tokens.
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.css',
})
export class StatusBadge {
  readonly status = input.required<BusinessStatus>();

  protected readonly modifier = computed(() => `status-badge--${this.status()}`);
  protected readonly labelKey = computed(() => STATUS_LABEL_KEY[this.status()]);
}

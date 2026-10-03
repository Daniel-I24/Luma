import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BusinessStatus =
  | 'open'
  | 'closed'
  | 'opening-soon'
  | 'closing-soon';

/**
 * StatusBadge — displays the operational status of a business.
 *
 * Maps to the --status-* design tokens.
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.css',
})
export class StatusBadge {
  readonly status = input.required<BusinessStatus>();

  /** Returns the CSS modifier class derived from the status value. */
  protected get modifier(): string {
    return `status-badge--${this.status()}`;
  }
}

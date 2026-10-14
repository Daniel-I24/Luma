import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LumaAvatar } from '../avatar/luma-avatar';
import { LumaRatingStars } from '../rating-stars/luma-rating-stars';
import { StatusBadge } from '../status-badge/status-badge';
import type { BusinessStatus } from '../status-badge/status-badge';

export type BusinessCardVariant = 'compact' | 'list';

/**
 * LumaBusinessCard — tappable business summary. `compact` fits horizontal
 * rows (logo on top); `list` is a full-width row. Texts arrive translated
 * and formatted (distance, promotion).
 */
@Component({
  selector: 'app-luma-business-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaAvatar, LumaRatingStars, StatusBadge],
  templateUrl: './luma-business-card.html',
  host: { class: 'block' },
})
export class LumaBusinessCard {
  readonly variant = input<BusinessCardVariant>('compact');
  readonly name = input.required<string>();
  readonly status = input.required<BusinessStatus>();
  readonly category = input<string | null>(null);
  readonly logoUrl = input<string | null>(null);
  readonly rating = input<number | null>(null);
  readonly distanceLabel = input<string | null>(null);
  readonly promoLabel = input<string | null>(null);
  /** Marks the card whose business is currently open in the map sheet. */
  readonly current = input(false);

  readonly selected = output<void>();
}

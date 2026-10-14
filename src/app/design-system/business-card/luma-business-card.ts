import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LumaAvatar } from '../avatar/luma-avatar';
import type { IconName } from '../icon/luma-icons';
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
  /** Shown on a token background when there is no logo (e.g. the category icon). */
  readonly logoIcon = input<IconName>('store');
  readonly rating = input<number | null>(null);
  /** Text shown instead of the stars when there is no rating (e.g. "Sin reseñas"). */
  readonly ratingFallback = input<string | null>(null);
  readonly distanceLabel = input<string | null>(null);
  readonly promoLabel = input<string | null>(null);
  /** Marks the card whose business is currently open in the map sheet. */
  readonly current = input(false);

  readonly selected = output<void>();
}

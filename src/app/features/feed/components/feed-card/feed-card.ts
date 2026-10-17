import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaButton, LumaIcon, StatusBadge } from '@design-system';
import { FavoriteButton } from '@shared/favorites/favorite-button/favorite-button';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { formatShortDate } from '@shared/format/date-format.util';
import { DistancePipe } from '@shared/geo/distance.pipe';
import type { FeedCard as FeedCardModel } from '../../models/feed-card.model';

/**
 * FeedCard — one full-screen post: visual (photo or category icon on a
 * gradient), title, price or validity, business with status and distance,
 * and the main actions. Extra actions (e.g. add to cart) are projected.
 */
@Component({
  selector: 'app-feed-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaButton,
    LumaIcon,
    StatusBadge,
    FavoriteButton,
    CopCurrencyPipe,
    DistancePipe,
  ],
  templateUrl: './feed-card.html',
  host: { class: 'block' },
})
export class FeedCard {
  private readonly transloco = inject(TranslocoService);
  protected readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly card = input.required<FeedCardModel>();
  /** 1-based position in the feed (aria-posinset). */
  readonly position = input.required<number>();
  /** Total posts loaded, or -1 while more can still arrive (aria-setsize). */
  readonly setSize = input.required<number>();

  readonly viewBusiness = output<void>();

  protected readonly headingId = computed(() => `feed-post-${this.position()}`);
  protected readonly validUntil = computed(() => {
    const iso = this.card().validUntil;
    return iso ? formatShortDate(iso, this.lang()) : null;
  });
}

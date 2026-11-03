import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaButton, LumaIcon, LumaImage, StatusBadge } from '@design-system';
import { AddToCart } from '@shared/cart/add-to-cart/add-to-cart';
import { CartMath } from '@shared/cart/cart.model';
import { FavoriteButton } from '@shared/favorites/favorite-button/favorite-button';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { DateFormat } from '@shared/format/date-format';
import { DistancePipe } from '@shared/geo/distance.pipe';
import type { FeedCard as FeedCardModel } from '../../models/feed-card.model';

/**
 * FeedCard — one full-screen post: visual (photo or category icon on a
 * gradient), title, price or validity, business with status and distance,
 * and the main actions (dishes can go straight to the cart).
 */
@Component({
  selector: 'app-feed-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaButton,
    LumaIcon,
    LumaImage,
    StatusBadge,
    FavoriteButton,
    AddToCart,
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

  public readonly card = input.required<FeedCardModel>();
  /** 1-based position in the feed (aria-posinset). */
  public readonly position = input.required<number>();
  /** Total posts loaded, or -1 while more can still arrive (aria-setsize). */
  public readonly setSize = input.required<number>();

  public readonly viewBusiness = output<void>();

  protected readonly headingId = computed(() => `feed-post-${this.position()}`);
  protected readonly product = computed(() => {
    const item = this.card().menuItem;
    if (!item) return null;
    // Informative price shown on the card; the server charges its own.
    return {
      ...CartMath.toCartProduct(item, this.card().business.name),
      priceCop: this.card().priceCop ?? item.price_cop,
    };
  });
  protected readonly validUntil = computed(() => {
    const iso = this.card().validUntil;
    return iso ? DateFormat.formatShortDate(iso, this.lang()) : null;
  });
}

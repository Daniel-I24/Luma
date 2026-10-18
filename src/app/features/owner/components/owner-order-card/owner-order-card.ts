import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaButton } from '@design-system';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { formatTime } from '@shared/format/date-format.util';
import type { BusinessOrder } from '@shared/orders/business-order.repository';
import { OrderStatusBadge } from '@shared/orders/order-status-badge';
import { type OrderAction, nextActions } from '../../utils/order-board.util';

/**
 * OwnerOrderCard — one order on the owner's board: customer label, times,
 * lines, the customer's notes (plain text, escaped by interpolation), total
 * and the next allowed actions.
 */
@Component({
  selector: 'app-owner-order-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, CopCurrencyPipe, OrderStatusBadge],
  templateUrl: './owner-order-card.html',
})
export class OwnerOrderCard {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly order = input.required<BusinessOrder>();
  readonly busy = input(false);
  readonly action = output<OrderAction>();

  protected readonly actions = computed(() => nextActions(this.order().status));
  protected readonly placedAt = computed(() => formatTime(this.order().created_at, this.lang()));
  protected readonly pickupAt = computed(() => {
    const pickup = this.order().pickup_at;
    return pickup ? formatTime(pickup, this.lang()) : null;
  });
}

import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ErrorLog } from '@core/errors/error-log';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaButton } from '@design-system';
import { AvatarRepository } from '@shared/account/avatar.repository';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { DateFormat } from '@shared/format/date-format';
import type { BusinessOrder } from '@shared/orders/business-order.repository';
import { OrderStatusBadge } from '@shared/orders/order-status-badge';
import { type OrderAction, OrderBoard } from '../../utils/order-board';

const STATUS_STRIPE: Readonly<Record<string, string>> = {
  pending: 'border-l-accent',
  accepted: 'border-l-info',
  preparing: 'border-l-info',
  ready: 'border-l-success',
  picked_up: 'border-l-border',
  cancelled: 'border-l-danger',
};

/** What the business must know about the money of an order. */
const PAYMENT_KEY: Readonly<Record<string, string>> = {
  approved: 'businessOrders.paidOnline',
  refund_required: 'businessOrders.paymentRefunding',
  refunded: 'businessOrders.paymentRefunded',
  voided: 'businessOrders.paymentVoided',
};

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

  public readonly order = input.required<BusinessOrder>();
  public readonly busy = input(false);
  public readonly action = output<OrderAction>();

  protected readonly actions = computed(() => OrderBoard.nextActions(this.order()));
  /** The colour of its state on the left edge: new, in the kitchen, ready, closed. */
  protected readonly stripe = computed(() => STATUS_STRIPE[this.order().status] ?? 'border-l-border');
  /** The customer's photo, only while serving them and if they share it (signed, 60 s). */
  protected readonly avatarUrl = signal<string | null>(null);
  private readonly avatars = inject(AvatarRepository);
  private readonly log = inject(ErrorLog);
  protected readonly paymentKey = computed(() => PAYMENT_KEY[this.order().payment_status] ?? null);
  protected readonly paidOnline = computed(() => this.order().payment_status === 'approved');
  protected readonly placedAt = computed(() => DateFormat.formatTime(this.order().created_at, this.lang()));
  protected readonly pickupAt = computed(() => {
    const pickup = this.order().pickup_at;
    return pickup ? DateFormat.formatTime(pickup, this.lang()) : null;
  });

  constructor() {
    effect(() => {
      const path = this.order().customer_avatar_path;
      if (!path) this.avatarUrl.set(null);
      else {
        this.avatars
          .signedUrl(path)
          .then((url) => this.avatarUrl.set(url))
          .catch((error: unknown) => {
            this.avatarUrl.set(null);
            this.log.record(error, 'owner');
          });
      }
    });
  }
}

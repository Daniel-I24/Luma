import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TourHelpButton } from '@shared/tutorial/tour-help-button';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaButton, LumaEmptyState, LumaSkeleton, LumaRefreshButton } from '@design-system';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { DateFormat } from '@shared/format/date-format';
import { OrderStatusBadge } from '@shared/orders/order-status-badge';
import { PaymentStatePipe } from '@shared/orders/payment-state.pipe';
import type { Order } from '@shared/orders/order.model';
import { OrderRepository } from '@shared/orders/order.repository';
import { RealtimeService } from '@core/realtime/realtime.service';
import { FreshnessNote } from '@shared/ui/freshness-note';
import { PullToRefreshDirective } from '@shared/ui/pull-to-refresh.directive';

type ListState = 'loading' | 'ready' | 'error';

/** OrdersPage — /orders ("Pedidos" tab): the user's orders, newest first. */
@Component({
  selector: 'app-orders-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LumaRefreshButton,
    TourHelpButton,
    TranslocoModule,
    RouterLink,
    LumaButton,
    LumaEmptyState,
    LumaSkeleton,
    CopCurrencyPipe,
    OrderStatusBadge,
    PaymentStatePipe,
    FreshnessNote,
    PullToRefreshDirective,
  ],
  templateUrl: './orders.page.html',
  host: { class: 'block' },
})
export class OrdersPage {
  private readonly repo = inject(OrderRepository);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly state = signal<ListState>('loading');
  protected readonly orders = signal<readonly Order[]>([]);
  /** New statuses of the user's orders, as the business changes them (docs/realtime.md). */
  protected readonly live = inject(RealtimeService).watch('order_events', () => this.refresh(), (event) => !!event.order_id && !!event.user_id);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    const result = await this.repo.list();
    this.orders.set(result.data ?? []);
    this.state.set(result.data ? 'ready' : 'error');
  }

  /** Re-reads the list without a loading state; a failure keeps what is shown. */
  protected async refresh(): Promise<void> {
    if (this.state() !== 'ready') return this.load();
    const result = await this.repo.list();
    if (result.data) this.orders.set(result.data);
  }

  protected when(order: Order): string {
    return DateFormat.formatDateTime(order.created_at, this.lang());
  }

  protected explore(): void {
    void this.router.navigate(['/map']);
  }
}

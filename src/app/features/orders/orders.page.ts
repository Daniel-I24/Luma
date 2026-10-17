import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaButton, LumaEmptyState, LumaSkeleton } from '@design-system';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { formatDateTime } from '@shared/format/date-format.util';
import { OrderStatusBadge } from '@shared/orders/order-status-badge';
import type { Order } from '@shared/orders/order.model';
import { OrderRepository } from '@shared/orders/order.repository';

type ListState = 'loading' | 'ready' | 'error';

/** OrdersPage — /orders ("Pedidos" tab): the user's orders, newest first. */
@Component({
  selector: 'app-orders-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaButton, LumaEmptyState, LumaSkeleton, CopCurrencyPipe, OrderStatusBadge],
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

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    const result = await this.repo.list();
    this.orders.set(result.data ?? []);
    this.state.set(result.data ? 'ready' : 'error');
  }

  protected when(order: Order): string {
    return formatDateTime(order.created_at, this.lang());
  }

  protected explore(): void {
    void this.router.navigate(['/map']);
  }
}

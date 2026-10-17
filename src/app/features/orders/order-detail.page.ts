import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';
import {
  LumaBottomSheet,
  LumaButton,
  LumaEmptyState,
  LumaIcon,
  LumaIconButton,
  LumaSkeleton,
} from '@design-system';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { formatTime } from '@shared/format/date-format.util';
import { OrderStatusBadge } from '@shared/orders/order-status-badge';
import type { OrderBusiness } from '@shared/orders/order.model';
import { pollWhileVisible } from '@shared/ui/poll-while-visible';
import { OrderTimeline } from './components/order-timeline/order-timeline';
import { OrderDetailStore } from './state/order-detail.store';
import { directionsUrl, estimatedReadyAt, showsEstimate } from './utils/order-detail.util';

/** Status refresh period while the screen is visible. */
export const ORDER_REFRESH_MS = 15_000;

/**
 * OrderDetailPage — /orders/:id: status timeline, estimated time, address
 * with directions, lines and total, and "Cancelar" while pending. Polls
 * every 15 s only while the screen is visible.
 */
@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaBottomSheet,
    LumaButton,
    LumaEmptyState,
    LumaIcon,
    LumaIconButton,
    LumaSkeleton,
    CopCurrencyPipe,
    OrderStatusBadge,
    OrderTimeline,
  ],
  providers: [OrderDetailStore],
  templateUrl: './order-detail.page.html',
  host: { class: 'block' },
})
export class OrderDetailPage {
  protected readonly store = inject(OrderDetailStore);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  private readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );

  protected readonly confirmOpen = signal(false);
  protected readonly estimate = computed(() => {
    const order = this.store.order();
    if (!order || !showsEstimate(order.status)) return null;
    return formatTime(estimatedReadyAt(order), this.lang());
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.store.load(id));
    });
    pollWhileVisible(() => void this.store.refresh(), ORDER_REFRESH_MS);
  }

  protected reload(): void {
    void this.store.load(this.id());
  }

  protected directions(business: OrderBusiness): string {
    return directionsUrl(business);
  }

  protected async cancel(): Promise<void> {
    this.confirmOpen.set(false);
    await this.store.cancel();
  }

  protected back(): void {
    void this.router.navigate(['/orders']);
  }
}

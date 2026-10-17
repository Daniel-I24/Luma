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
import { GeolocationService } from '@shared/geo/geolocation.service';
import { haversineKm } from '@shared/geo/haversine.util';
import { estimateReadyAt, estimateTravelMinutes } from '@shared/orders/order-estimates.util';
import { OrderStatusBadge } from '@shared/orders/order-status-badge';
import type { OrderBusiness } from '@shared/orders/order.model';
import { pollWhileVisible } from '@shared/ui/poll-while-visible';
import { OrderTimeline } from './components/order-timeline/order-timeline';
import { OrderDetailStore } from './state/order-detail.store';
import { directionsUrl, showsEstimate } from './utils/order-detail.util';

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
  private readonly geo = inject(GeolocationService);
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
    const ready = estimateReadyAt(order, order.business?.prep_minutes);
    const key = ready.kind === 'pickup' ? 'orders.detail.pickupAt' : 'orders.detail.readyAround';
    return { key, time: formatTime(ready.at, this.lang()) };
  });
  /** Approximate trip to the business, only once the user's location is known. */
  protected readonly travel = computed(() => {
    const business = this.store.order()?.business;
    if (!business || !this.geo.hasRealLocation()) return null;
    const { lat, lng } = this.geo.coords();
    return estimateTravelMinutes(haversineKm(lat, lng, business.latitude, business.longitude));
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

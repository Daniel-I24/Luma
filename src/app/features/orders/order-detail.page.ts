import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { RouteMap } from '@shared/route/route-map/route-map';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';
import { LumaBottomSheet, LumaButton, LumaEmptyState, LumaIcon, LumaIconButton, LumaSkeleton } from '@design-system';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { DateFormat } from '@shared/format/date-format';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { Haversine } from '@shared/geo/distance';
import { OrderEstimates } from '@shared/orders/order-estimates';
import { OrderStatusBadge } from '@shared/orders/order-status-badge';
import type { OrderWithItems } from '@shared/orders/order.model';
import { PollWhileVisible } from '@shared/ui/poll-while-visible';
import { AppEvents } from '@core/native/app-events';
import { OrderPayment } from './components/order-payment/order-payment';
import { ReorderService } from './services/reorder.service';
import { OrderTimeline } from './components/order-timeline/order-timeline';
import { OrderDetailStore } from './state/order-detail.store';
import { OrderDetailView } from './utils/order-detail-view';

/** Status refresh period while the screen is visible. */
export const ORDER_REFRESH_MS = 15_000;

/**
 * OrderDetailPage — /orders/:id: status timeline, estimated time, address
 * with the route drawn in the app (RouteMap), lines and total, the online payment, and "Cancelar"
 * while pending or waiting for the payment. Re-reads the server when the
 * app comes back (e.g. from Wompi's checkout). Polls
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
    OrderPayment,
    RouteMap,
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
  protected readonly reorder = inject(ReorderService);
  protected readonly estimate = computed(() => {
    const order = this.store.order();
    if (!order || !OrderDetailView.showsEstimate(order.status)) return null;
    const ready = OrderEstimates.estimateReadyAt(order, order.business?.prep_minutes);
    const key = ready.kind === 'pickup' ? 'orders.detail.pickupAt' : 'orders.detail.readyAround';
    return { key, time: DateFormat.formatTime(ready.at, this.lang()) };
  });
  /** Approximate trip to the business, only once the user's location is known. */
  protected readonly travel = computed(() => {
    const business = this.store.order()?.business;
    if (!business || !this.geo.hasRealLocation()) return null;
    const { lat, lng } = this.geo.coords();
    return OrderEstimates.estimateTravelMinutes(Haversine.haversineKm(lat, lng, business.latitude, business.longitude));
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.store.load(id));
    });
    PollWhileVisible.pollWhileVisible(() => void this.store.refresh(), ORDER_REFRESH_MS);
    // Back from the payment page: the server, not the redirect, says how it went.
    const events = inject(AppEvents);
    let seen = events.resumes();
    effect(() => {
      const resumes = events.resumes();
      if (resumes === seen) return;
      seen = resumes;
      untracked(() => void this.store.refresh());
    });
  }

  protected reload(): void {
    void this.store.load(this.id());
  }

  protected async cancel(): Promise<void> {
    this.confirmOpen.set(false);
    await this.store.cancel();
  }

  /** "Pedir de nuevo": the old lines go back to the cart, which re-checks the menu. */
  protected orderAgain(order: OrderWithItems): void {
    if (this.reorder.reorder(order)) void this.router.navigate(['/cart']);
  }

  protected back(): void {
    void this.router.navigate(['/orders']);
  }
}

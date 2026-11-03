import { Injectable, inject, signal } from '@angular/core';
import { NativeHaptics } from '@core/native/native-haptics';
import { ToastService } from '@design-system';
import { BusinessOrderRepository } from '@shared/orders/business-order.repository';

/** How often Luma Negocios checks for new orders while it is visible. */
export const ORDER_ALERT_POLL_MS = 20_000;

/**
 * OrderAlertsStore — pending orders of the business shown in Luma Negocios,
 * wherever the owner is: the count for the Pedidos tab and, when a new one
 * arrives, a toast and a short vibration. The first read of a business
 * never alerts (those orders were already there).
 */
@Injectable()
export class OrderAlertsStore {
  private readonly repo = inject(BusinessOrderRepository);
  private readonly toast = inject(ToastService);
  private readonly haptics = inject(NativeHaptics);

  private readonly _pending = signal(0);
  private businessId: string | null = null;
  private known: Set<string> | null = null;

  public readonly pending = this._pending.asReadonly();

  /** Starts watching another business (no alert for what it already has). */
  public watch(businessId: string): Promise<void> {
    if (businessId === this.businessId) return Promise.resolve();
    this.businessId = businessId;
    this.known = null;
    this._pending.set(0);
    return this.refresh();
  }

  public async refresh(): Promise<void> {
    const id = this.businessId;
    if (!id) return;
    const result = await this.repo.pendingIds(id);
    // A failed check keeps the last count: alerts are best effort.
    if (!result.data || id !== this.businessId) return;
    const fresh = this.known ? result.data.filter((orderId) => !this.known!.has(orderId)) : [];
    this.known = new Set(result.data);
    this._pending.set(result.data.length);
    if (fresh.length > 0) {
      this.toast.show({ messageKey: 'owner.orderAlerts.new', params: { count: fresh.length }, tone: 'info' });
      void this.haptics.tap();
    }
  }
}

import { Injectable, computed, inject, signal } from '@angular/core';
import type { OrderStatus, OrderWithItems } from '@shared/orders/order.model';
import { OrderRepository, type PickupPoint } from '@shared/orders/order.repository';

export type OrderDetailState = 'loading' | 'ready' | 'notFound' | 'error';

/** The customer is on the way while the business has the order: the map and the route show then. */
const ON_THE_WAY: ReadonlySet<OrderStatus> = new Set(['accepted', 'preparing', 'ready']);

/** OrderDetailStore — one order, refreshed in the background, and its cancellation. */
@Injectable()
export class OrderDetailStore {
  private readonly repo = inject(OrderRepository);

  private readonly _state = signal<OrderDetailState>('loading');
  private readonly _order = signal<OrderWithItems | null>(null);
  private readonly _cancelling = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  /** From order_pickup_point when the business is no longer public (paused, suspended). */
  private readonly _fallback = signal<PickupPoint | null>(null);
  private id: string | null = null;

  public readonly state = this._state.asReadonly();
  public readonly order = this._order.asReadonly();
  public readonly cancelling = this._cancelling.asReadonly();
  /** Error of the last action (cancelling); loading errors use `state`. */
  public readonly errorKey = this._errorKey.asReadonly();
  /** Where to go, while the order is accepted, being prepared or ready; null otherwise. */
  public readonly pickup = computed<PickupPoint | null>(() => {
    const order = this._order();
    if (!order || !ON_THE_WAY.has(order.status)) return null;
    const business = order.business;
    if (!business) return this._fallback();
    return { name: order.business_name, address: order.business_address, latitude: business.latitude, longitude: business.longitude };
  });

  /** Loads an order with its items. */
  public async load(id: string): Promise<void> {
    this.id = id;
    this._state.set('loading');
    await this.refresh();
  }

  /** Re-reads the order; a failed background refresh keeps what is shown. */
  public async refresh(): Promise<void> {
    if (!this.id) return;
    const result = await this.repo.getById(this.id);
    if (result.errorKey) {
      if (!this._order()) this._state.set('error');
      return;
    }
    this._order.set(result.data);
    this._state.set(result.data ? 'ready' : 'notFound');
    const order = result.data;
    if (order && !order.business && ON_THE_WAY.has(order.status) && !this._fallback()) {
      this._fallback.set((await this.repo.pickupPoint(order.id)).data);
    }
  }

  /** Cancels the order while it is still pending. */
  public async cancel(): Promise<void> {
    if (!this.id || this._cancelling()) return;
    this._cancelling.set(true);
    this._errorKey.set(null);
    const result = await this.repo.cancel(this.id);
    if (result.errorKey) this._errorKey.set(result.errorKey);
    await this.refresh();
    this._cancelling.set(false);
  }
}

import { Injectable, inject, signal } from '@angular/core';
import type { OrderWithItems } from '@shared/orders/order.model';
import { OrderRepository } from '@shared/orders/order.repository';

export type OrderDetailState = 'loading' | 'ready' | 'notFound' | 'error';

/** OrderDetailStore — one order, refreshed in the background, and its cancellation. */
@Injectable()
export class OrderDetailStore {
  private readonly repo = inject(OrderRepository);

  private readonly _state = signal<OrderDetailState>('loading');
  private readonly _order = signal<OrderWithItems | null>(null);
  private readonly _cancelling = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  private id: string | null = null;

  readonly state = this._state.asReadonly();
  readonly order = this._order.asReadonly();
  readonly cancelling = this._cancelling.asReadonly();
  /** Error of the last action (cancelling); loading errors use `state`. */
  readonly errorKey = this._errorKey.asReadonly();

  async load(id: string): Promise<void> {
    this.id = id;
    this._state.set('loading');
    await this.refresh();
  }

  /** Re-reads the order; a failed background refresh keeps what is shown. */
  async refresh(): Promise<void> {
    if (!this.id) return;
    const result = await this.repo.getById(this.id);
    if (result.errorKey) {
      if (!this._order()) this._state.set('error');
      return;
    }
    this._order.set(result.data);
    this._state.set(result.data ? 'ready' : 'notFound');
  }

  async cancel(): Promise<void> {
    if (!this.id || this._cancelling()) return;
    this._cancelling.set(true);
    this._errorKey.set(null);
    const result = await this.repo.cancel(this.id);
    if (result.errorKey) this._errorKey.set(result.errorKey);
    await this.refresh();
    this._cancelling.set(false);
  }
}

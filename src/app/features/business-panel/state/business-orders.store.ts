import { Injectable, inject, signal } from '@angular/core';
import {
  type BusinessOrder,
  BusinessOrderRepository,
  type OwnerOrderAction,
} from '@shared/orders/business-order.repository';

export type BoardState = 'loading' | 'ready' | 'error';

/** BusinessOrdersStore — orders of the managed business, refreshed in the background. */
@Injectable()
export class BusinessOrdersStore {
  private readonly repo = inject(BusinessOrderRepository);

  private readonly _state = signal<BoardState>('loading');
  private readonly _orders = signal<readonly BusinessOrder[]>([]);
  private readonly _busyId = signal<string | null>(null);
  private readonly _errorKey = signal<string | null>(null);
  private businessId: string | null = null;

  readonly state = this._state.asReadonly();
  readonly orders = this._orders.asReadonly();
  /** Order whose status is being changed. */
  readonly busyId = this._busyId.asReadonly();
  /** Error of the last action; loading errors use `state`. */
  readonly errorKey = this._errorKey.asReadonly();

  async load(businessId: string): Promise<void> {
    this.businessId = businessId;
    this._state.set('loading');
    await this.refresh();
  }

  /** Re-reads the orders; a failed background refresh keeps what is shown. */
  async refresh(): Promise<void> {
    if (!this.businessId) return;
    const result = await this.repo.list(this.businessId);
    if (!result.data) {
      if (this._state() !== 'ready') this._state.set('error');
      return;
    }
    this._orders.set(result.data);
    this._state.set('ready');
  }

  /** Resolves to true when the status changed. */
  async act(order: BusinessOrder, status: OwnerOrderAction): Promise<boolean> {
    if (this._busyId()) return false;
    this._busyId.set(order.id);
    this._errorKey.set(null);
    try {
      const result = await this.repo.setStatus(order.id, status);
      this._errorKey.set(result.errorKey);
      await this.refresh();
      return result.errorKey === null;
    } finally {
      this._busyId.set(null);
    }
  }
}

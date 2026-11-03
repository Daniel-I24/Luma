import { Injectable, computed, inject, signal } from '@angular/core';
import { type SalesDay, type SalesRange, type SalesSummary, SalesSummaryRepository } from '../services/sales-summary.repository';

// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- data table: the ranges the owner can pick, in days
export const SALES_RANGES: readonly SalesRange[] = [7, 30];

/** Which measure the bars show. */
export type SalesMeasure = 'orders' | 'revenue';

/** A bar of the chart: its day, value and height as a share of the tallest. */
export interface SalesBar {
  readonly day: string;
  readonly value: number;
  readonly share: number;
}

/**
 * SalesSummaryStore — "Ventas" on Resumen: the last 7 or 30 days, orders or
 * revenue per day as bars, totals and the 5 most ordered dishes.
 */
@Injectable()
export class SalesSummaryStore {
  private readonly repo = inject(SalesSummaryRepository);

  public readonly range = signal<SalesRange>(SALES_RANGES[0]);
  public readonly measure = signal<SalesMeasure>('orders');
  private readonly _summary = signal<SalesSummary | null>(null);
  private readonly _state = signal<'loading' | 'ready' | 'error'>('loading');
  private businessId: string | null = null;

  public readonly summary = this._summary.asReadonly();
  public readonly state = this._state.asReadonly();
  public readonly totals = computed(() => {
    const days = this._summary()?.days ?? [];
    return { orders: days.reduce((n, d) => n + d.orders, 0), revenueCop: days.reduce((n, d) => n + d.revenueCop, 0) };
  });
  public readonly bars = computed<SalesBar[]>(() => {
    const days = this._summary()?.days ?? [];
    const value = (d: SalesDay): number => (this.measure() === 'orders' ? d.orders : d.revenueCop);
    const max = Math.max(1, ...days.map(value));
    return days.map((d) => ({ day: d.day, value: value(d), share: value(d) / max }));
  });

  public async load(businessId: string, range: SalesRange = this.range()): Promise<void> {
    this.businessId = businessId;
    this.range.set(range);
    this._state.set('loading');
    const result = await this.repo.daily(businessId, range);
    this._summary.set(result.data);
    this._state.set(result.data ? 'ready' : 'error');
  }

  public setRange(range: SalesRange): Promise<void> {
    return this.businessId ? this.load(this.businessId, range) : Promise.resolve();
  }
}

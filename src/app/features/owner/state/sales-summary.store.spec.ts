import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SalesSummaryRepository } from '../services/sales-summary.repository';
import { SalesSummaryStore } from './sales-summary.store';

describe('SalesSummaryStore', () => {
  const repo = { daily: vi.fn() };
  const summary = {
    days: [{ day: '2026-10-25', orders: 2, revenueCop: 12000 }, { day: '2026-10-26', orders: 4, revenueCop: 6000 }],
    topItems: [{ name: 'Tinto', quantity: 9 }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.daily.mockResolvedValue({ data: summary, errorKey: null });
    TestBed.configureTestingModule({ providers: [SalesSummaryStore, { provide: SalesSummaryRepository, useValue: repo }] });
  });

  it('turns days into bars relative to the busiest day, for orders or revenue', async () => {
    const store = TestBed.inject(SalesSummaryStore);
    await store.load('b1');
    expect(store.totals()).toEqual({ orders: 6, revenueCop: 18000 });
    expect(store.bars().map((b) => b.share)).toEqual([0.5, 1]);
    store.measure.set('revenue');
    expect(store.bars().map((b) => b.share)).toEqual([1, 0.5]);
  });

  it('asks the server again for another range and reports a failure', async () => {
    const store = TestBed.inject(SalesSummaryStore);
    await store.load('b1');
    repo.daily.mockResolvedValueOnce({ data: null, errorKey: 'owner.sales.errors.loadFailed' });
    await store.setRange(30);
    expect(repo.daily).toHaveBeenLastCalledWith('b1', 30);
    expect(store.state()).toBe('error');
  });
});

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderRepository } from '@shared/orders/order.repository';
import { OrderDetailStore } from './order-detail.store';

const order = (status: string) => ({ id: 'o1', status, items: [] });

describe('OrderDetailStore', () => {
  const repo = { getById: vi.fn(), cancel: vi.fn() };
  let store: OrderDetailStore;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [OrderDetailStore, { provide: OrderRepository, useValue: repo }],
    });
    store = TestBed.inject(OrderDetailStore);
  });

  it('loads an order, or reports it as not found', async () => {
    repo.getById.mockResolvedValueOnce({ data: order('pending'), errorKey: null });
    await store.load('o1');
    expect(store.state()).toBe('ready');

    repo.getById.mockResolvedValueOnce({ data: null, errorKey: null });
    await store.load('o2');
    expect(store.state()).toBe('notFound');
  });

  it('keeps showing the order when a background refresh fails', async () => {
    repo.getById.mockResolvedValueOnce({ data: order('pending'), errorKey: null });
    await store.load('o1');
    repo.getById.mockResolvedValueOnce({ data: null, errorKey: 'orders.errors.loadFailed' });

    await store.refresh();

    expect(store.state()).toBe('ready');
    expect(store.order()?.status).toBe('pending');
  });

  it('cancels and shows the new status, or the reason it could not', async () => {
    repo.getById.mockResolvedValue({ data: order('pending'), errorKey: null });
    await store.load('o1');

    repo.cancel.mockResolvedValueOnce({ data: true, errorKey: null });
    repo.getById.mockResolvedValueOnce({ data: order('cancelled'), errorKey: null });
    await store.cancel();
    expect(repo.cancel).toHaveBeenCalledWith('o1');
    expect(store.order()?.status).toBe('cancelled');

    repo.cancel.mockResolvedValueOnce({ data: null, errorKey: 'orders.errors.invalidTransition' });
    await store.cancel();
    expect(store.errorKey()).toBe('orders.errors.invalidTransition');
    expect(store.cancelling()).toBe(false);
  });
});

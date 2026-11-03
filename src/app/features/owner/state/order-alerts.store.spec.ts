import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NativeHaptics } from '@core/native/native-actions';
import { ToastService } from '@design-system';
import { BusinessOrderRepository } from '@shared/orders/business-order.repository';
import { OrderAlertsStore } from './order-alerts.store';

describe('OrderAlertsStore', () => {
  const repo = { pendingIds: vi.fn() };
  const toast = { show: vi.fn() };
  const haptics = { tap: vi.fn() };
  let store: OrderAlertsStore;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        OrderAlertsStore,
        { provide: BusinessOrderRepository, useValue: repo },
        { provide: ToastService, useValue: toast },
        { provide: NativeHaptics, useValue: haptics },
      ],
    });
    store = TestBed.inject(OrderAlertsStore);
  });

  const pending = (...ids: string[]) => repo.pendingIds.mockResolvedValueOnce({ data: ids, errorKey: null });

  it('the first read only counts; a new order alerts with a toast and a vibration', async () => {
    pending('o1', 'o2');
    await store.watch('b1');
    expect([store.pending(), toast.show.mock.calls.length]).toEqual([2, 0]);
    pending('o1', 'o2', 'o3');
    await store.refresh();
    expect(store.pending()).toBe(3);
    expect(toast.show).toHaveBeenCalledWith({ messageKey: 'owner.orderAlerts.new', params: { count: 1 }, tone: 'info' });
    expect(haptics.tap).toHaveBeenCalledTimes(1);
  });

  it('accepted orders lower the count without alerting; failures keep it', async () => {
    pending('o1', 'o2');
    await store.watch('b1');
    pending('o2');
    await store.refresh();
    repo.pendingIds.mockResolvedValueOnce({ data: null, errorKey: 'x' });
    await store.refresh();
    expect([store.pending(), toast.show.mock.calls.length]).toEqual([1, 0]);
  });

  it('switching business starts again without alerting for its old orders', async () => {
    pending('o1');
    await store.watch('b1');
    pending('x1', 'x2');
    await store.watch('b2');
    expect([store.pending(), toast.show.mock.calls.length]).toEqual([2, 0]);
  });
});

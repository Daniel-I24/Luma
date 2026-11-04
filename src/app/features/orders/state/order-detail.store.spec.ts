import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderRepository } from '@shared/orders/order.repository';
import { OrderDetailStore } from './order-detail.store';

const order = (status: string, visible: boolean) => ({
  id: 'o1', status, business_name: 'Fritanga', business_address: 'Calle 19 # 20-10',
  business: visible ? { id: 'b1', latitude: 1.21, longitude: -77.28, prep_minutes: 15 } : null,
});

describe('OrderDetailStore pick-up point', () => {
  const repo = { getById: vi.fn(), pickupPoint: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    repo.pickupPoint.mockResolvedValue({ data: { name: 'Fritanga', address: 'Calle 19 # 20-10', latitude: 1.21, longitude: -77.28 }, errorKey: null });
    TestBed.configureTestingModule({ providers: [OrderDetailStore, { provide: OrderRepository, useValue: repo }] });
  });

  it('only while accepted, preparing or ready', async () => {
    const store = TestBed.inject(OrderDetailStore);
    for (const [status, shown] of [['pending', false], ['accepted', true], ['preparing', true], ['ready', true], ['picked_up', false]] as const) {
      repo.getById.mockResolvedValue({ data: order(status, true), errorKey: null });
      await store.load('o1');
      expect(store.pickup() !== null).toBe(shown);
    }
    expect(repo.pickupPoint).not.toHaveBeenCalled();
  });

  it('a paused or suspended business (hidden by RLS) is still reachable through order_pickup_point', async () => {
    repo.getById.mockResolvedValue({ data: order('ready', false), errorKey: null });
    const store = TestBed.inject(OrderDetailStore);
    await store.load('o1');
    expect(repo.pickupPoint).toHaveBeenCalledWith('o1');
    expect(store.pickup()).toEqual({ name: 'Fritanga', address: 'Calle 19 # 20-10', latitude: 1.21, longitude: -77.28 });
  });
});

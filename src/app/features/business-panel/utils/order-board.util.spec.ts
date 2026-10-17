import { describe, expect, it } from 'vitest';
import type { BusinessOrder } from '@shared/orders/business-order.repository';
import { nextActions, orderTab, ordersOfTab } from './order-board.util';

const order = (id: string, status: BusinessOrder['status'], created_at: string) =>
  ({ id, status, created_at }) as BusinessOrder;

describe('order board', () => {
  it('puts each status in its tab', () => {
    expect(orderTab('pending')).toBe('new');
    expect(orderTab('accepted')).toBe('preparing');
    expect(orderTab('preparing')).toBe('preparing');
    expect(orderTab('ready')).toBe('ready');
    expect(orderTab('picked_up')).toBe('history');
    expect(orderTab('cancelled')).toBe('history');
  });

  it('offers only the transitions set_order_status allows', () => {
    expect(nextActions('pending').map((a) => a.status)).toEqual(['accepted', 'cancelled']);
    expect(nextActions('pending')[1].confirm).toBe(true);
    expect(nextActions('accepted').map((a) => a.status)).toEqual(['preparing']);
    expect(nextActions('preparing').map((a) => a.status)).toEqual(['ready']);
    expect(nextActions('ready').map((a) => a.status)).toEqual(['picked_up']);
    expect(nextActions('picked_up')).toEqual([]);
    expect(nextActions('cancelled')).toEqual([]);
  });

  it('serves active orders oldest first and shows history newest first', () => {
    const orders = [
      order('a', 'pending', '2026-10-14T12:05:00Z'),
      order('b', 'pending', '2026-10-14T12:01:00Z'),
      order('c', 'picked_up', '2026-10-14T11:00:00Z'),
      order('d', 'cancelled', '2026-10-14T11:30:00Z'),
    ];
    expect(ordersOfTab(orders, 'new').map((o) => o.id)).toEqual(['b', 'a']);
    expect(ordersOfTab(orders, 'history').map((o) => o.id)).toEqual(['d', 'c']);
    expect(ordersOfTab(orders, 'ready')).toEqual([]);
  });
});

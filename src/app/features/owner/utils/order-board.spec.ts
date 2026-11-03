import { describe, expect, it } from 'vitest';
import type { BusinessOrder } from '@shared/orders/business-order.repository';
import { OrderBoard } from './order-board';

const order = (id: string, status: BusinessOrder['status'], created_at: string) =>
  ({ id, status, created_at }) as BusinessOrder;

describe('order board', () => {
  it('puts each status in its tab', () => {
    expect(OrderBoard.orderTab('pending')).toBe('new');
    expect(OrderBoard.orderTab('accepted')).toBe('preparing');
    expect(OrderBoard.orderTab('preparing')).toBe('preparing');
    expect(OrderBoard.orderTab('ready')).toBe('ready');
    expect(OrderBoard.orderTab('picked_up')).toBe('history');
    expect(OrderBoard.orderTab('cancelled')).toBe('history');
  });

  it('offers only the transitions set_order_status allows', () => {
    const at = (status: BusinessOrder['status'], readyAt: string | null = null) =>
      OrderBoard.nextActions({ status, ready_at: readyAt }, Date.parse('2026-10-14T12:30:00Z'));
    expect(at('pending').map((a) => [a.key, a.confirm])).toEqual([['accept', null], ['reject', 'reject']]);
    expect(at('accepted').map((a) => [a.status, a.confirm])).toEqual([['preparing', null], ['cancelled', 'cancel']]);
    expect(at('preparing').map((a) => a.key)).toEqual(['ready', 'cancel']);
    expect(at('picked_up')).toEqual([]);
    expect(at('cancelled')).toEqual([]);
  });

  it('"No llegó" appears only 15 minutes after the order is ready', () => {
    const now = Date.parse('2026-10-14T12:30:00Z');
    expect(OrderBoard.nextActions({ status: 'ready', ready_at: '2026-10-14T12:20:00Z' }, now).map((a) => a.key))
      .toEqual(['deliver', 'cancel']);
    expect(OrderBoard.nextActions({ status: 'ready', ready_at: '2026-10-14T12:15:00Z' }, now).map((a) => [a.key, a.confirm]))
      .toEqual([['deliver', null], ['noShow', 'no_show']]);
    expect(OrderBoard.noShowAllowed(null, now)).toBe(false);
  });

  it('serves active orders oldest first and shows history newest first', () => {
    const orders = [
      order('a', 'pending', '2026-10-14T12:05:00Z'),
      order('b', 'pending', '2026-10-14T12:01:00Z'),
      order('c', 'picked_up', '2026-10-14T11:00:00Z'),
      order('d', 'cancelled', '2026-10-14T11:30:00Z'),
    ];
    expect(OrderBoard.ordersOfTab(orders, 'new').map((o) => o.id)).toEqual(['b', 'a']);
    expect(OrderBoard.ordersOfTab(orders, 'history').map((o) => o.id)).toEqual(['d', 'c']);
    expect(OrderBoard.ordersOfTab(orders, 'ready')).toEqual([]);
  });
});

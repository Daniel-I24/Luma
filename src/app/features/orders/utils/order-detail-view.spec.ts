import { describe, expect, it } from 'vitest';
import { OrderDetailView } from './order-detail-view';

describe('order detail helpers', () => {
  it('shows the estimate only before the order is ready', () => {
    expect(['pending', 'accepted', 'preparing'].every((s) => OrderDetailView.showsEstimate(s as 'pending'))).toBe(
      true,
    );
    expect(OrderDetailView.showsEstimate('ready')).toBe(false);
    expect(OrderDetailView.showsEstimate('cancelled')).toBe(false);
  });
});

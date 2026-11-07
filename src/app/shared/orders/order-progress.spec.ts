import { describe, expect, it } from 'vitest';
import { OrderProgress } from './order-progress';

const states = (status: Parameters<typeof OrderProgress.steps>[0]) =>
  OrderProgress.steps(status).map((step) => step.state);

describe('OrderProgress', () => {
  it('marks the steps before the current one done, and the rest upcoming', () => {
    expect(states('preparing')).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming']);
    expect(states('pending')).toEqual(['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('picked up is the end: every step, the last one included, is done', () => {
    expect(states('picked_up')).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('a cancelled or unpaid order has not started', () => {
    expect(states('cancelled').every((state) => state === 'upcoming')).toBe(true);
    expect(states('awaiting_payment').every((state) => state === 'upcoming')).toBe(true);
  });
});

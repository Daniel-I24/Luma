import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentGatewayFactory } from '@shared/payments/payment-gateway';
import { PaymentRepository } from '@shared/payments/payment.repository';
import { OrderPaymentStore } from './order-payment.store';

describe('OrderPaymentStore', () => {
  const repo = { orderPayment: vi.fn() };
  const online = { start: vi.fn() };
  const future = '2999-01-01T00:00:00Z';

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        OrderPaymentStore,
        { provide: PaymentRepository, useValue: repo },
        { provide: PaymentGatewayFactory, useValue: { for: () => online } },
      ],
    });
  });

  const payment = (attemptsUsed: number, expiresAt = future, status = 'declined') =>
    ({ data: { status, attemptsUsed, attemptsMax: 3, expiresAt }, errorKey: null });

  it('counts the attempts left and stops when they run out or the order expires', async () => {
    const store = TestBed.inject(OrderPaymentStore);
    repo.orderPayment.mockResolvedValueOnce(payment(1));
    await store.load('o1');
    expect([store.attemptsLeft(), store.canStillPay()]).toEqual([2, true]);
    repo.orderPayment.mockResolvedValueOnce(payment(3));
    await store.load('o1');
    expect(store.canStillPay()).toBe(false);
    repo.orderPayment.mockResolvedValueOnce(payment(1, '2000-01-01T00:00:00Z'));
    await store.load('o1');
    expect(store.canStillPay()).toBe(false);
  });

  it('"Reintentar pago" opens a new checkout and shows why it could not', async () => {
    const store = TestBed.inject(OrderPaymentStore);
    repo.orderPayment.mockResolvedValue(payment(1));
    await store.load('o1');
    online.start.mockResolvedValueOnce({ kind: 'failed', errorKey: 'payments.errors.tooManyAttempts' });
    await store.pay();
    expect(online.start).toHaveBeenCalledWith('o1');
    expect(store.errorKey()).toBe('payments.errors.tooManyAttempts');
    online.start.mockResolvedValueOnce({ kind: 'redirected' });
    await store.pay();
    expect(store.errorKey()).toBeNull();
  });

  it('disables "Reintentar pago" with its cause: paid, no attempts left or expired', async () => {
    const store = TestBed.inject(OrderPaymentStore);
    repo.orderPayment.mockResolvedValueOnce(payment(1, future, 'approved'));
    await store.load('o1');
    expect(store.blockedKey()).toBe('payments.errors.alreadyPaid');
    repo.orderPayment.mockResolvedValueOnce(payment(3));
    await store.load('o1');
    expect(store.blockedKey()).toBe('payments.errors.tooManyAttempts');
    repo.orderPayment.mockResolvedValueOnce(payment(1, '2000-01-01T00:00:00Z'));
    await store.load('o1');
    expect(store.blockedKey()).toBe('payments.errors.expired');
    await store.pay();
    expect(online.start).not.toHaveBeenCalled();
  });

  it('an attempt still in progress counts down the time left and then allows a retry', async () => {
    vi.useFakeTimers();
    try {
      const store = TestBed.inject(OrderPaymentStore);
      repo.orderPayment.mockResolvedValue(payment(1, future, 'pending'));
      await store.load('o1');
      online.start.mockResolvedValueOnce({ kind: 'failed', errorKey: 'payments.errors.attemptInProgress', retryAfterSeconds: 95 });
      await store.pay();
      expect([store.blockedKey(), store.waitLabel(), store.errorKey()]).toEqual(['payments.errors.attemptInProgress', '1:35', null]);
      vi.advanceTimersByTime(35_000);
      expect(store.waitLabel()).toBe('1:00');
      vi.advanceTimersByTime(60_000);
      expect([store.waitSeconds(), store.blockedKey()]).toEqual([0, null]);
    } finally {
      vi.useRealTimers();
    }
  });
});

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminOperationsRepository, type PaymentIssue } from '../services/admin-operations.repository';
import { AdminOperationsStore } from './admin-operations.store';
import { at } from '../../../../testing/at';

describe('AdminOperationsStore', () => {
  const issue = { payment_id: 'p1', order_id: 'o1', amount_in_cents: 600000, status: 'refund_required',
    payment_method_type: 'NEQUI', issue: 'refund_required', created_at: '' } as PaymentIssue;
  const repo = {
    paymentIssues: vi.fn(), strikes: vi.fn(), recentAudit: vi.fn(),
    voidPayment: vi.fn(), markRefundDone: vi.fn(), clearStrikes: vi.fn(), reconcile: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.paymentIssues.mockResolvedValue({ data: [issue], errorKey: null });
    repo.strikes.mockResolvedValue({ data: [{ user_id: 'u1', strikes: 3, last_strike_at: null, tier: 'restricted' }], errorKey: null });
    repo.recentAudit.mockResolvedValue({ data: [], errorKey: null });
    TestBed.configureTestingModule({ providers: [AdminOperationsStore, { provide: AdminOperationsRepository, useValue: repo }] });
  });

  it('loads the three lists and fails as a whole', async () => {
    const store = TestBed.inject(AdminOperationsStore);
    await store.load();
    expect([store.state(), store.issues().length, store.strikes().length]).toEqual(['ready', 1, 1]);
    repo.recentAudit.mockResolvedValueOnce({ data: null, errorKey: 'x' });
    await store.load();
    expect(store.state()).toBe('error');
  });

  it('a non-card void asks for a manual refund; every action reloads', async () => {
    const store = TestBed.inject(AdminOperationsStore);
    repo.voidPayment.mockResolvedValue({ data: 'manual', errorKey: null });
    await store.voidPayment(issue);
    expect(store.notice()).toBe('admin.operations.void.manual');
    repo.markRefundDone.mockResolvedValue({ data: true, errorKey: null });
    await store.markRefundDone(issue);
    expect(repo.markRefundDone).toHaveBeenCalledWith('p1');
    expect(store.notice()).toBe('admin.operations.refundMarked');
    repo.clearStrikes.mockResolvedValue({ data: null, errorKey: 'admin.operations.errors.failed' });
    await store.clearStrikes(at(store.strikes(), 0));
    expect(store.notice()).toBe('admin.operations.errors.failed');
    expect(repo.paymentIssues).toHaveBeenCalledTimes(3);
  });
});

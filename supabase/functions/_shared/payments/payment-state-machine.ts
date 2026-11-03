/** Status of one payment attempt (public.payments.status). */
export type PaymentStatus = 'pending' | 'approved' | 'declined' | 'error' | 'voided' | 'refund_required' | 'refunded';

/**
 * PaymentStateMachine — the transitions of an attempt. Mirrors
 * public.payment_transition_allowed; both are tested with
 * supabase/tests/fixtures/payment_transitions.json.
 */
export class PaymentStateMachine {
  private static readonly NEXT: ReadonlyMap<PaymentStatus, ReadonlySet<PaymentStatus>> = new Map([
    ['pending', new Set<PaymentStatus>(['approved', 'declined', 'error', 'voided'])],
    // Wompi lets the customer retry the same reference for a few minutes.
    ['declined', new Set<PaymentStatus>(['approved'])],
    ['error', new Set<PaymentStatus>(['approved'])],
    ['approved', new Set<PaymentStatus>(['voided', 'refund_required'])],
    ['refund_required', new Set<PaymentStatus>(['refunded', 'voided'])],
  ]);

  /** True when `from` may move to `to`; staying in the same status is not a transition. */
  public static canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
    return PaymentStateMachine.NEXT.get(from)?.has(to) ?? false;
  }

  /** Wompi transaction status to attempt status; PENDING and unknown values move nothing. */
  public static fromProvider(status: string): PaymentStatus | null {
    const map: Readonly<Record<string, PaymentStatus>> = {
      APPROVED: 'approved', DECLINED: 'declined', ERROR: 'error', VOIDED: 'voided',
    };
    return map[status] ?? null;
  }
}

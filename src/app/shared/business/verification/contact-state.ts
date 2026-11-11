import type { ContactVerification } from './contact-verification';

/**
 * Where one contact stands for its owner: never asked ("Sin verificar"),
 * waiting for the team ("En revisión"), verified, or rejected by the team
 * with its reason.
 */
export type ContactState =
  | { readonly status: 'unverified' }
  | { readonly status: 'review'; readonly request: ContactVerification }
  | { readonly status: 'verified' }
  | { readonly status: 'rejected'; readonly reason: string | null };

/** ContactStates — the state of a contact from the business and the owner's requests. */
export class ContactStates {
  /**
   * @param requests the owner's requests, newest first (any value, any kind).
   * @param value the current value of the contact; requests for older values do not count.
   * @param verified true when the business already carries its verified date.
   */
  public static of(requests: readonly ContactVerification[], value: string, verified: boolean): ContactState {
    const mine = requests.filter((r) => r.value === value);
    if (verified || mine.some((r) => r.status === 'verified')) return { status: 'verified' };
    const pending = mine.find((r) => r.status === 'pending');
    if (pending) return { status: 'review', request: pending };
    // A request replaced by a newer one, or voided by a changed value, has no decision date.
    const latest = mine[0];
    if (latest?.status === 'rejected' && latest.verified_at) return { status: 'rejected', reason: latest.reject_reason };
    return { status: 'unverified' };
  }
}

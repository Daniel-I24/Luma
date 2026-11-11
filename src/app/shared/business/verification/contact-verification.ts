import type { Business } from '../models/business.model';

/** The contacts of a business the review team can verify. */
export const CONTACT_KINDS = ['phone', 'whatsapp', 'instagram', 'facebook', 'website'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

/** One request of the owner (public.contact_verifications). */
export interface ContactVerification {
  readonly id: string;
  readonly kind: ContactKind;
  readonly value: string;
  readonly code: string;
  readonly status: 'pending' | 'verified' | 'rejected';
  readonly requested_at: string;
  /** When the team (or an automatic check) decided; null while pending or when replaced. */
  readonly verified_at: string | null;
  /** Why the team rejected it (contact_review migration). */
  readonly reject_reason: string | null;
}

/** A request in the admin queue. */
export interface PendingContactVerification {
  readonly id: string;
  readonly business_id: string;
  readonly business_name: string;
  readonly kind: ContactKind;
  readonly value: string;
  readonly code: string;
  readonly requested_at: string;
}

/** VerifiedContacts — what the customer may see: only contacts the review team verified. */
export class VerifiedContacts {
  /** When the team verified that contact, or null. */
  public static verifiedAt(business: Partial<Business>, kind: ContactKind): string | null {
    return business[`${kind}_verified_at`] ?? null;
  }

  /** True once the team verified that contact. */
  public static isVerified(business: Partial<Business>, kind: ContactKind): boolean {
    return VerifiedContacts.verifiedAt(business, kind) !== null;
  }

  /** The current value of a contact, or null when the business has none. */
  public static value(business: Partial<Business>, kind: ContactKind): string | null {
    return business[kind]?.trim() || null;
  }
}

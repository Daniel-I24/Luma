import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '../data/business.repository';
import type { ContactKind, ContactVerification, PendingContactVerification } from './contact-verification';

/** Messages of the round5 contact functions and their translation keys. */
const CONTACT_ERRORS: Readonly<Record<string, string>> = {
  too_many_requests: 'contactVerification.errors.tooMany',
  contact_missing: 'contactVerification.errors.missing',
  email_not_confirmed: 'errors.emailNotConfirmed',
  not_owner: 'contactVerification.errors.failed',
  not_admin: 'admin.errors.notAdmin',
  contact_changed: 'contactVerification.errors.changed',
  verification_not_pending: 'contactVerification.errors.notPending',
};

const fail = (message: string | undefined, fallback: string): RepoResult<never> => ({
  data: null,
  errorKey: (message && CONTACT_ERRORS[message.trim()]) || fallback,
});

/**
 * ContactVerificationRepository — the owner asks the review team to verify
 * a contact (gets a LUMA-XXXXXX code and the steps), and the team decides
 * from its queue (admin with aal2). The database writes the verified dates.
 */
@Injectable({ providedIn: 'root' })
export class ContactVerificationRepository {
  private readonly db = inject(SupabaseService).client;

  /** The owner's requests for a business, newest first. */
  public async listMine(businessId: string): Promise<RepoResult<ContactVerification[]>> {
    const { data, error } = await this.db
      .from('contact_verifications')
      .select('id, kind, value, code, status, requested_at')
      .eq('business_id', businessId)
      .order('requested_at', { ascending: false });
    if (error) return fail(undefined, 'contactVerification.errors.load');
    return { data: data as ContactVerification[], errorKey: null };
  }

  /** Asks to verify the current value of a contact; resolves to the code to publish or send. */
  public async request(businessId: string, kind: ContactKind): Promise<RepoResult<string>> {
    const { data, error } = await this.db.rpc('request_contact_verification', { p_business_id: businessId, p_kind: kind });
    if (error || typeof data !== 'string') return fail(error?.message, 'contactVerification.errors.failed');
    return { data, errorKey: null };
  }

  /** Admin: requests waiting for review, oldest first. */
  public async pending(): Promise<RepoResult<PendingContactVerification[]>> {
    const { data, error } = await this.db.rpc('admin_pending_contact_verifications');
    if (error) return fail(error.message, 'contactVerification.errors.load');
    return { data: (data ?? []) as PendingContactVerification[], errorKey: null };
  }

  /** Admin: verifies or rejects a request (audited; the owner is notified). */
  public async decide(id: string, decision: 'verified' | 'rejected'): Promise<RepoResult<true>> {
    const { error } = await this.db.rpc('admin_verify_contact', { p_verification_id: id, p_decision: decision });
    if (error) return fail(error.message, 'contactVerification.errors.failed');
    return { data: true, errorKey: null };
  }
}

import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '../data/business.repository';
import { CONTACT_KINDS, type ContactKind, type ContactVerification, type PendingContactVerification } from './contact-verification';
import type { VerifierStrategy } from './contact-verifier';

/** What the team decides about a request. */
export type ContactDecision = { readonly status: 'verified' } | { readonly status: 'rejected'; readonly reason: string };

/** verify-website answers; reason when not verified. */
export type WebsiteCheck = { readonly verified: true } | { readonly verified: false; readonly reasonKey: string };

/** Messages of the round5 contact functions and their translation keys. */
const CONTACT_ERRORS: Readonly<Record<string, string>> = {
  too_many_requests: 'contactVerification.errors.tooMany',
  contact_missing: 'contactVerification.errors.missing',
  email_not_confirmed: 'errors.emailNotConfirmed',
  not_owner: 'contactVerification.errors.failed',
  not_admin: 'admin.errors.notAdmin',
  contact_changed: 'contactVerification.errors.changed',
  verification_not_pending: 'contactVerification.errors.notPending',
  reason_required: 'admin.contacts.reasonRequired',
  too_many_checks: 'contactVerification.errors.tooManyChecks',
  no_pending_request: 'contactVerification.errors.noPending',
  auto_disabled: 'contactVerification.errors.autoOff',
};
const STRATEGIES = new Set<string>(['whatsapp', 'website', 'manual']);

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
      .select('id, kind, value, code, status, requested_at, verified_at, reject_reason')
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

  /** Admin: verifies, or rejects with a reason the owner reads (audited; the owner is notified). */
  public async decide(id: string, decision: ContactDecision): Promise<RepoResult<true>> {
    const { error } = await this.db.rpc('admin_verify_contact', {
      p_verification_id: id,
      p_decision: decision.status,
      p_reason: decision.status === 'rejected' ? decision.reason : null,
    });
    if (error) return fail(error.message, 'contactVerification.errors.failed');
    return { data: true, errorKey: null };
  }

  /** Strategy per kind; on any error every kind is manual (the queue always works). */
  public async config(): Promise<Partial<Record<ContactKind, VerifierStrategy>>> {
    const { data, error } = await this.db.rpc('contact_verifier_config');
    if (error || !Array.isArray(data)) return {};
    const rows = data as { kind: string; strategy: string }[];
    return Object.fromEntries(
      rows.filter((r) => (CONTACT_KINDS as readonly string[]).includes(r.kind) && STRATEGIES.has(r.strategy))
        .map((r) => [r.kind, r.strategy]),
    );
  }

  /** verify-website: Luma looks for the code in the website's file now (3 checks a day). */
  public async checkWebsite(businessId: string): Promise<WebsiteCheck> {
    try {
      const { data, error } = await this.db.functions.invoke('verify-website', { method: 'POST', body: { business_id: businessId } });
      const body = (error ? await readError(error) : data) as WebsiteAnswer | null;
      return websiteResult(body);
    } catch {
      return { verified: false, reasonKey: 'contactVerification.website.failed' };
    }
  }
}

interface WebsiteAnswer {
  readonly verified?: boolean;
  readonly reason?: string;
  readonly error?: string;
}

/** The answer of verify-website as the owner reads it. */
const websiteResult = (body: WebsiteAnswer | null): WebsiteCheck => {
  if (body?.verified === true) return { verified: true };
  const reason = body?.reason ?? body?.error ?? 'failed';
  const own = `contactVerification.website.${WEBSITE_REASONS.has(reason) ? reason : 'failed'}`;
  return { verified: false, reasonKey: CONTACT_ERRORS[reason] ?? own };
};

const WEBSITE_REASONS = new Set(['mismatch', 'not_found', 'too_large', 'blocked', 'unreachable', 'changed']);

/** The JSON body of a FunctionsHttpError, if any. */
const readError = async (error: unknown): Promise<unknown> => {
  const context = (error as { context?: unknown }).context;
  return context instanceof Response ? context.json().catch(() => null) : null;
};

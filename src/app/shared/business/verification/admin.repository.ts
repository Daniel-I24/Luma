import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '../data/business.repository';
import type { Business } from '../models/business.model';
import { type OpenReport, type ReviewDecision, VERIFICATION_BUCKET, type VerificationDoc } from './verification.model';

/** Signed document URLs live one minute. */
export const SIGNED_URL_SECONDS = 60;
const ADMIN_ERRORS: Readonly<Record<string, string>> = {
  note_required: 'admin.errors.noteRequired',
  invalid_transition: 'admin.errors.invalidTransition',
  not_admin: 'admin.errors.notAdmin',
  stale_review: 'admin.errors.staleReview',
  tax_id_in_use: 'admin.errors.taxIdInUse',
};

/** admin_access(): not an admin, an admin who still has to pass MFA (aal2), or ready. */
export type AdminAccess = 'none' | 'needs_mfa' | 'ok';

/** AdminRepository — admin reads and decisions (aal2 checked in SQL). */
@Injectable({ providedIn: 'root' })
export class AdminRepository {
  private readonly db = inject(SupabaseService).client;

  /** Whether the user is an admin and has a verified second factor. */
  public async access(): Promise<AdminAccess> {
    const { data, error } = await this.db.rpc('admin_access');
    return !error && (data === 'ok' || data === 'needs_mfa') ? data : 'none';
  }

  /** Businesses waiting for review. */
  public async pendingBusinesses(): Promise<RepoResult<Business[]>> {
    const { data, error } = await this.db
      .from('businesses')
      .select('*')
      .eq('verification_status', 'pending')
      .order('updated_at');
    if (error) return { data: null, errorKey: 'admin.errors.loadFailed' };
    return { data: data as Business[], errorKey: null };
  }

  /** One business, or null when it does not exist. */
  public async business(id: string): Promise<RepoResult<Business | null>> {
    const { data, error } = await this.db.from('businesses').select('*').eq('id', id).maybeSingle();
    if (error) return { data: null, errorKey: 'admin.errors.loadFailed' };
    return { data: data as Business | null, errorKey: null };
  }

  /** A short-lived URL to read a verification document. */
  public async signedDocUrl(doc: VerificationDoc): Promise<RepoResult<string>> {
    const { data, error } = await this.db.storage
      .from(VERIFICATION_BUCKET)
      .createSignedUrl(doc.storage_path, SIGNED_URL_SECONDS);
    if (error || !data) return { data: null, errorKey: 'admin.errors.docFailed' };
    return { data: data.signedUrl, errorKey: null };
  }

  /** Approves, rejects or suspends a business with a note (audited). */
  public async review(
    id: string,
    decision: ReviewDecision,
    note: string | null,
    seenUpdatedAt: string,
  ): Promise<RepoResult<true>> {
    const { error } = await this.db.rpc('review_business', {
      p_business_id: id,
      p_decision: decision,
      p_note: note,
      p_seen_updated_at: seenUpdatedAt,
    });
    if (error)
      return { data: null, errorKey: ADMIN_ERRORS[error.message] ?? 'admin.errors.reviewFailed' };
    return { data: true, errorKey: null };
  }

  /** Deletes reviewed verification documents from Storage. */
  public async deleteDocs(docs: readonly VerificationDoc[]): Promise<RepoResult<true>> {
    if (docs.length === 0) return { data: true, errorKey: null };
    const removed = await this.db.storage
      .from(VERIFICATION_BUCKET)
      .remove(docs.map((d) => d.storage_path));
    if (removed.error) return { data: null, errorKey: 'admin.errors.docsDeleteFailed' };
    const { error } = await this.db
      .from('business_verification_docs')
      .delete()
      .in(
        'id',
        docs.map((d) => d.id),
      );
    return error
      ? { data: null, errorKey: 'admin.errors.docsDeleteFailed' }
      : { data: true, errorKey: null };
  }

  /** Reports not yet resolved. */
  public async openReports(): Promise<RepoResult<OpenReport[]>> {
    const { data, error } = await this.db.rpc('admin_open_reports');
    if (error) return { data: null, errorKey: 'admin.errors.loadFailed' };
    return { data: data as OpenReport[], errorKey: null };
  }

  /** Closes a report. */
  public async resolveReport(id: string, status: 'reviewed' | 'dismissed'): Promise<RepoResult<true>> {
    const { error } = await this.db.rpc('resolve_report', { p_report_id: id, p_status: status });
    return error
      ? { data: null, errorKey: 'admin.errors.reviewFailed' }
      : { data: true, errorKey: null };
  }
}

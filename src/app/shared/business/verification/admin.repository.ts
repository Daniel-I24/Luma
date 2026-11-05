import { Injectable, inject, signal } from '@angular/core';
import { ErrorCode } from '@core/errors/error-code';
import { ErrorLog } from '@core/errors/error-log';
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

/** admin_access(): not an admin, an admin who still has to pass MFA (aal2), ready, or it could not be read. */
export type AdminAccess = 'none' | 'needs_mfa' | 'ok' | 'error';

/** The last answer of admin_access, for "Información técnica": a code, never personal data. */
export interface AdminAccessStatus {
  readonly access: AdminAccess;
  readonly code: string | null;
  readonly at: string;
}

/** AdminRepository — admin reads and decisions (aal2 checked in SQL). */
@Injectable({ providedIn: 'root' })
export class AdminRepository {
  private readonly db = inject(SupabaseService).client;
  private readonly log = inject(ErrorLog);
  private readonly _lastAccess = signal<AdminAccessStatus | null>(null);
  public readonly lastAccess = this._lastAccess.asReadonly();

  /** Whether the user is an admin with a verified second factor; 'error' keeps its code. Never rejects. */
  public async access(): Promise<AdminAccess> {
    const { access, code } = await this.readAccess();
    this._lastAccess.set({ access, code, at: new Date().toISOString() });
    if (code) this.log.record(new Error(`admin_access: ${code}`), 'admin');
    return access;
  }

  private async readAccess(): Promise<{ access: AdminAccess; code: string | null }> {
    try {
      const { data, error } = await this.db.rpc('admin_access');
      if (error) return { access: 'error', code: ErrorCode.of(error) };
      return data === 'ok' || data === 'needs_mfa' || data === 'none'
        ? { access: data, code: null }
        : { access: 'error', code: 'unexpected_answer' };
    } catch (error) {
      return { access: 'error', code: ErrorCode.of(error) };
    }
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

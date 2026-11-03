import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '../data/business.repository';
import type { Business } from '../models/business.model';
import {
  type OpenReport,
  type ReviewDecision,
  VERIFICATION_BUCKET,
  type VerificationDoc,
} from './verification.model';

/** Signed document URLs live one minute. */
export const SIGNED_URL_SECONDS = 60;
const ADMIN_ERRORS: Readonly<Record<string, string>> = {
  note_required: 'admin.errors.noteRequired',
  invalid_transition: 'admin.errors.invalidTransition',
  not_admin: 'admin.errors.notAdmin',
  stale_review: 'admin.errors.staleReview',
};

/** admin_access(): not an admin, an admin who still has to pass MFA (aal2), or ready. */
export type AdminAccess = 'none' | 'needs_mfa' | 'ok';

/** Contract: what the review team reads and decides (Supabase is one implementation). */
@Injectable({ providedIn: 'root', useFactory: () => new SupabaseAdminRepository() })
export abstract class AdminRepository {
  /** 'none' also when the server cannot be reached: never a guess in favour of access. */
  public abstract access(): Promise<AdminAccess>;
  /** Businesses waiting for review. */
  public abstract pendingBusinesses(): Promise<RepoResult<Business[]>>;
  /** One business, or null when it does not exist. */
  public abstract business(id: string): Promise<RepoResult<Business | null>>;
  /** A short-lived URL to read a verification document. */
  public abstract signedDocUrl(doc: VerificationDoc): Promise<RepoResult<string>>;
  /** seenUpdatedAt: businesses.updated_at as shown; a newer one is stale_review. */
  public abstract review(
    id: string,
    decision: ReviewDecision,
    note: string | null,
    seenUpdatedAt: string,
  ): Promise<RepoResult<true>>;
  /** Removes every document of a business (after approval). */
  public abstract deleteDocs(docs: readonly VerificationDoc[]): Promise<RepoResult<true>>;
  /** Reports not yet resolved. */
  public abstract openReports(): Promise<RepoResult<OpenReport[]>>;
  /** Closes a report. */
  public abstract resolveReport(id: string, status: 'reviewed' | 'dismissed'): Promise<RepoResult<true>>;
}

/** SupabaseAdminRepository — admin reads and decisions (aal2 checked in SQL). */
export class SupabaseAdminRepository extends AdminRepository {
  private readonly db = inject(SupabaseService).client;

  /** Whether the user is an admin and has a verified second factor. */
  public async access(): Promise<AdminAccess> {
    const { data, error } = await this.db.rpc('admin_access');
    return !error && (data === 'ok' || data === 'needs_mfa') ? data : 'none';
  }

  /** @inheritdoc */
  public async pendingBusinesses(): Promise<RepoResult<Business[]>> {
    const { data, error } = await this.db
      .from('businesses')
      .select('*')
      .eq('verification_status', 'pending')
      .order('updated_at');
    if (error) return { data: null, errorKey: 'admin.errors.loadFailed' };
    return { data: data as Business[], errorKey: null };
  }

  /** @inheritdoc */
  public async business(id: string): Promise<RepoResult<Business | null>> {
    const { data, error } = await this.db.from('businesses').select('*').eq('id', id).maybeSingle();
    if (error) return { data: null, errorKey: 'admin.errors.loadFailed' };
    return { data: data as Business | null, errorKey: null };
  }

  /** @inheritdoc */
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

  /** @inheritdoc */
  public async openReports(): Promise<RepoResult<OpenReport[]>> {
    const { data, error } = await this.db.rpc('admin_open_reports');
    if (error) return { data: null, errorKey: 'admin.errors.loadFailed' };
    return { data: data as OpenReport[], errorKey: null };
  }

  /** @inheritdoc */
  public async resolveReport(id: string, status: 'reviewed' | 'dismissed'): Promise<RepoResult<true>> {
    const { error } = await this.db.rpc('resolve_report', { p_report_id: id, p_status: status });
    return error
      ? { data: null, errorKey: 'admin.errors.reviewFailed' }
      : { data: true, errorKey: null };
  }
}

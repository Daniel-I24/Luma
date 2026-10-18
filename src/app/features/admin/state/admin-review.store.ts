import { Injectable, inject, signal } from '@angular/core';
import type { Business } from '@shared/business/models/business.model';
import { AdminRepository } from '@shared/business/verification/admin.repository';
import type {
  LegalInfo,
  ReviewDecision,
  VerificationDoc,
} from '@shared/business/verification/verification.model';
import { VerificationRepository } from '@shared/business/verification/verification.repository';

export type ReviewState = 'loading' | 'ready' | 'notFound' | 'error';

/**
 * AdminReviewStore — one business under review: its data, legal data and
 * documents, and the decision. Approving deletes the documents (they are
 * only needed for the review); rejecting keeps them for the resubmission.
 */
@Injectable()
export class AdminReviewStore {
  private readonly admin = inject(AdminRepository);
  private readonly verification = inject(VerificationRepository);

  private readonly _state = signal<ReviewState>('loading');
  private readonly _business = signal<Business | null>(null);
  private readonly _legal = signal<LegalInfo | null>(null);
  private readonly _docs = signal<readonly VerificationDoc[]>([]);
  private readonly _busy = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  readonly state = this._state.asReadonly();
  readonly business = this._business.asReadonly();
  readonly legal = this._legal.asReadonly();
  readonly docs = this._docs.asReadonly();
  readonly busy = this._busy.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();

  async load(id: string): Promise<void> {
    this._state.set('loading');
    const [business, legal, docs] = await Promise.all([
      this.admin.business(id),
      this.verification.getLegal(id),
      this.verification.listDocs(id),
    ]);
    if (business.errorKey || legal.errorKey || docs.errorKey) {
      this._state.set('error');
      return;
    }
    this._business.set(business.data);
    this._legal.set(legal.data);
    this._docs.set(docs.data ?? []);
    this._state.set(business.data ? 'ready' : 'notFound');
  }

  /** Opens a document with a signed URL that expires in a minute. */
  async signedUrl(doc: VerificationDoc): Promise<string | null> {
    this._errorKey.set(null);
    const result = await this.admin.signedDocUrl(doc);
    this._errorKey.set(result.errorKey);
    return result.data;
  }

  /** Resolves to true when the decision was saved. */
  async decide(decision: ReviewDecision, note: string | null): Promise<boolean> {
    const business = this._business();
    if (!business || this._busy()) return false;
    this._busy.set(true);
    this._errorKey.set(null);
    try {
      const result = await this.admin.review(business.id, decision, note);
      if (result.errorKey) {
        this._errorKey.set(result.errorKey);
        return false;
      }
      if (decision === 'approved') {
        const deleted = await this.admin.deleteDocs(this._docs());
        this._errorKey.set(deleted.errorKey);
      }
      await this.load(business.id);
      return true;
    } finally {
      this._busy.set(false);
    }
  }
}

import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  DocKind,
  LegalInfo,
  ReviewRequirement,
  VerificationDoc,
} from '@shared/business/verification/verification.model';
import { VerificationRepository } from '@shared/business/verification/verification.repository';
import { EDITABLE_STATUSES } from '../utils/review-checklist.util';
import { PanelBusinessStore } from './panel-business.store';

/**
 * VerificationStore — legal data, documents and the review request of the
 * managed business. The database decides what may change (only while draft
 * or rejected); `editable` mirrors it for the UI.
 */
@Injectable()
export class VerificationStore {
  private readonly repo = inject(VerificationRepository);
  private readonly panel = inject(PanelBusinessStore);

  private readonly _legal = signal<LegalInfo | null>(null);
  private readonly _docs = signal<readonly VerificationDoc[]>([]);
  private readonly _busy = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  /** Requirements the server reported on the last submit. */
  private readonly _serverMissing = signal<readonly ReviewRequirement[]>([]);

  readonly legal = this._legal.asReadonly();
  readonly docs = this._docs.asReadonly();
  readonly busy = this._busy.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();
  readonly serverMissing = this._serverMissing.asReadonly();
  readonly editable = computed(() => {
    const status = this.panel.business()?.verification_status;
    return !!status && EDITABLE_STATUSES.includes(status);
  });

  async load(businessId: string): Promise<void> {
    const [legal, docs] = await Promise.all([
      this.repo.getLegal(businessId),
      this.repo.listDocs(businessId),
    ]);
    this._legal.set(legal.data);
    this._docs.set(docs.data ?? []);
    this._errorKey.set(legal.errorKey ?? docs.errorKey);
  }

  saveLegal(taxId: string, legalName: string, legalRep: string): Promise<boolean> {
    return this.run((id) => this.repo.saveLegal(id, taxId, legalName, legalRep));
  }

  uploadDoc(kind: DocKind, file: File): Promise<boolean> {
    return this.run((id) => this.repo.uploadDoc(id, kind, file));
  }

  deleteDoc(doc: VerificationDoc): Promise<boolean> {
    return this.run(() => this.repo.deleteDoc(doc));
  }

  /** Asks for review; on success the business is pending. */
  async submit(): Promise<boolean> {
    const business = this.panel.business();
    if (!business || this._busy()) return false;
    this._busy.set(true);
    this._errorKey.set(null);
    const result = await this.repo.submit(business.id);
    this._busy.set(false);
    if (!result.data) {
      this._errorKey.set(result.errorKey);
      return false;
    }
    this._serverMissing.set(result.data.missing);
    if (result.data.ok)
      this.panel.patch({ verification_status: 'pending', verification_note: null });
    return result.data.ok;
  }

  /** Runs a write, then re-reads legal data and documents. */
  private async run(
    write: (businessId: string) => Promise<{ errorKey: string | null }>,
  ): Promise<boolean> {
    const business = this.panel.business();
    if (!business || this._busy()) return false;
    this._busy.set(true);
    this._errorKey.set(null);
    const result = await write(business.id);
    this._busy.set(false);
    if (result.errorKey) {
      this._errorKey.set(result.errorKey);
      return false;
    }
    await this.load(business.id);
    return true;
  }
}

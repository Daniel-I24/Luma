import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  DocKind,
  LegalInfo,
  VerificationDoc,
} from '@shared/business/verification/verification.model';
import { VerificationRepository } from '@shared/business/verification/verification.repository';
import { EDITABLE_STATUSES, OWNER_CORRECTION_NOTE } from '../utils/review-checklist';
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

  public readonly legal = this._legal.asReadonly();
  public readonly docs = this._docs.asReadonly();
  public readonly busy = this._busy.asReadonly();
  public readonly errorKey = this._errorKey.asReadonly();
  public readonly editable = computed(() => {
    const status = this.panel.business()?.verification_status;
    return !!status && EDITABLE_STATUSES.includes(status);
  });

  /** Loads the legal data and documents of a business. */
  public async load(businessId: string): Promise<void> {
    const [legal, docs] = await Promise.all([
      this.repo.getLegal(businessId),
      this.repo.listDocs(businessId),
    ]);
    this._legal.set(legal.data);
    this._docs.set(docs.data ?? []);
    this._errorKey.set(legal.errorKey ?? docs.errorKey);
  }

  /** Saves the legal data; true when saved. */
  public saveLegal(taxId: string, legalName: string, legalRep: string): Promise<boolean> {
    return this.run((id) => this.repo.saveLegal(id, taxId, legalName, legalRep));
  }

  /** Uploads a verification document; true when uploaded. */
  public uploadDoc(kind: DocKind, file: File): Promise<boolean> {
    return this.run((id) => this.repo.uploadDoc(id, kind, file));
  }

  /** Deletes a verification document; true when deleted. */
  public deleteDoc(doc: VerificationDoc): Promise<boolean> {
    return this.run(() => this.repo.deleteDoc(doc));
  }

  /** An approved business asks to correct its legal data: hidden and editable until a new review. */
  public async requestLegalCorrection(): Promise<boolean> {
    const ok = await this.run((id) => this.repo.requestLegalCorrection(id));
    if (ok) this.panel.patch({ verification_status: 'rejected', verification_note: OWNER_CORRECTION_NOTE });
    return ok;
  }

  /** Asks for review; on success the business is pending. */
  public async submit(): Promise<boolean> {
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

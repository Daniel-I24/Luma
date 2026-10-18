import { Injectable, inject } from '@angular/core';
import * as z from 'zod/mini';
import { SupabaseService } from '@core/supabase/supabase.service';
import { Nit } from '../domain/nit';
import type { RepoResult } from '../data/business.repository';
import { mapWriteError } from '../data/business-write-error';
import {
  DOC_MAX_BYTES,
  DOC_TYPES,
  type DocKind,
  type LegalInfo,
  REVIEW_REQUIREMENTS,
  type SubmitResult,
  VERIFICATION_BUCKET,
  type VerificationDoc,
} from './verification.model';

const SAVE_FAILED = 'verification.errors.saveFailed';
const submitSchema = z.object({
  ok: z.boolean(),
  missing: z.array(z.enum(REVIEW_REQUIREMENTS)),
});

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/** Contract: an owner's verification data (Supabase is one implementation). */
@Injectable({ providedIn: 'root', useFactory: () => new SupabaseVerificationRepository() })
export abstract class VerificationRepository {
  abstract getLegal(businessId: string): Promise<RepoResult<LegalInfo | null>>;
  abstract saveLegal(
    businessId: string,
    taxId: string,
    legalName: string,
    legalRep: string,
  ): Promise<RepoResult<true>>;
  abstract listDocs(businessId: string): Promise<RepoResult<VerificationDoc[]>>;
  abstract uploadDoc(businessId: string, kind: DocKind, file: File): Promise<RepoResult<true>>;
  abstract deleteDoc(doc: VerificationDoc): Promise<RepoResult<true>>;
  abstract submit(businessId: string): Promise<RepoResult<SubmitResult>>;
}

export class SupabaseVerificationRepository extends VerificationRepository {
  private readonly db = inject(SupabaseService).client;

  async getLegal(businessId: string): Promise<RepoResult<LegalInfo | null>> {
    const { data, error } = await this.db
      .from('business_legal')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();
    if (error) return { data: null, errorKey: 'verification.errors.loadFailed' };
    return { data: data as LegalInfo | null, errorKey: null };
  }

  async saveLegal(
    businessId: string,
    taxId: string,
    legalName: string,
    legalRep: string,
  ): Promise<RepoResult<true>> {
    const nit = Nit.parse(taxId);
    if (!nit) return { data: null, errorKey: 'verification.validation.nit' };
    const values = {
      tax_id: nit.value,
      legal_name: legalName.trim(),
      legal_rep_name: legalRep.trim(),
    };
    const existing = await this.getLegal(businessId);
    if (existing.errorKey) return { data: null, errorKey: existing.errorKey };
    const { error } = existing.data
      ? await this.db
          .from('business_legal')
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq('business_id', businessId)
      : await this.db.from('business_legal').insert({ ...values, business_id: businessId });
    return error
      ? { data: null, errorKey: mapWriteError(error, SAVE_FAILED) }
      : { data: true, errorKey: null };
  }

  async listDocs(businessId: string): Promise<RepoResult<VerificationDoc[]>> {
    const { data, error } = await this.db
      .from('business_verification_docs')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at');
    if (error) return { data: null, errorKey: 'verification.errors.loadFailed' };
    return { data: data as VerificationDoc[], errorKey: null };
  }

  /** Uploads the file to the private bucket, then records it. */
  async uploadDoc(businessId: string, kind: DocKind, file: File): Promise<RepoResult<true>> {
    if (!(DOC_TYPES as readonly string[]).includes(file.type)) {
      return { data: null, errorKey: 'verification.errors.docType' };
    }
    if (file.size > DOC_MAX_BYTES) return { data: null, errorKey: 'verification.errors.docSize' };
    const path = `${businessId}/${kind}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
    const bucket = this.db.storage.from(VERIFICATION_BUCKET);
    const uploaded = await bucket.upload(path, file, { contentType: file.type, upsert: false });
    if (uploaded.error) return { data: null, errorKey: 'verification.errors.uploadFailed' };
    const { error } = await this.db
      .from('business_verification_docs')
      .insert({ business_id: businessId, kind, storage_path: path });
    if (error) {
      await bucket.remove([path]);
      return { data: null, errorKey: mapWriteError(error, SAVE_FAILED) };
    }
    return { data: true, errorKey: null };
  }

  async deleteDoc(doc: VerificationDoc): Promise<RepoResult<true>> {
    const removed = await this.db.storage.from(VERIFICATION_BUCKET).remove([doc.storage_path]);
    if (removed.error) return { data: null, errorKey: 'verification.errors.deleteFailed' };
    const { error } = await this.db.from('business_verification_docs').delete().eq('id', doc.id);
    return error
      ? { data: null, errorKey: 'verification.errors.deleteFailed' }
      : { data: true, errorKey: null };
  }

  async submit(businessId: string): Promise<RepoResult<SubmitResult>> {
    const { data, error } = await this.db.rpc('submit_business_for_review', {
      p_business_id: businessId,
    });
    if (error) return { data: null, errorKey: 'verification.errors.submitFailed' };
    const parsed = submitSchema.safeParse(data);
    return parsed.success
      ? { data: parsed.data, errorKey: null }
      : { data: null, errorKey: 'verification.errors.submitFailed' };
  }
}

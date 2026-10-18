/** Kinds of verification documents (business_docs_kind_valid). */
export const DOC_KINDS = ['rut', 'facade', 'other'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

/** What submit_business_for_review may report as missing, in display order. */
export const REVIEW_REQUIREMENTS = [
  'name',
  'category',
  'address',
  'location',
  'phone',
  'open_day',
  'available_item',
  'legal',
  'doc_rut',
  'doc_facade',
] as const;
export type ReviewRequirement = (typeof REVIEW_REQUIREMENTS)[number];

/** Row of public.business_legal (private: owner and admins). */
export interface LegalInfo {
  readonly business_id: string;
  /** Stored form "800197268-4". */
  readonly tax_id: string;
  readonly legal_name: string;
  readonly legal_rep_name: string;
}

/** Row of public.business_verification_docs. */
export interface VerificationDoc {
  readonly id: string;
  readonly business_id: string;
  readonly kind: DocKind;
  readonly storage_path: string;
  readonly created_at: string;
}

export interface SubmitResult {
  readonly ok: boolean;
  readonly missing: readonly ReviewRequirement[];
}

/** Admin decisions (review_business). */
export type ReviewDecision = 'approved' | 'rejected' | 'suspended';

/** Reasons a user may report a business for (reports_reason_valid). */
export const REPORT_REASONS = ['false_info', 'not_exists', 'inappropriate', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** An open report as admins see it (never the reporter). */
export interface OpenReport {
  readonly id: string;
  readonly business_id: string;
  readonly business_name: string;
  readonly reason: ReportReason;
  readonly comment: string | null;
  readonly created_at: string;
}

/** Limits of the verification-docs bucket. */
export const DOC_MAX_BYTES = 5 * 1024 * 1024;
export const DOC_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const VERIFICATION_BUCKET = 'verification-docs';

/**
 * Sections of the legal drafts, in reading order. Texts live under
 * legal.{document}.sections.{id}.{title|body} in the translation files, the
 * one source of the app pages and of the public pages that
 * scripts/build-legal.mjs writes to public/legal/.
 */
export const LEGAL_DOCUMENTS = {
  terms: [
    'controller',
    'service',
    'accounts',
    'orders',
    'businesses',
    'verification',
    'conduct',
    'liability',
    'changes',
    'contact',
  ],
  privacy: [
    'controller',
    'data',
    'purposes',
    'location',
    'sharing',
    'rights',
    'exercise',
    'retention',
    'security',
    'minors',
    'changes',
  ],
  refunds: ['scope', 'processor', 'cancellations', 'refunds', 'timing', 'pickup', 'contact'],
  deletion: ['how', 'what', 'kept', 'help'],
} as const;

export type LegalDocument = keyof typeof LEGAL_DOCUMENTS;

/** LegalDocuments — the legal documents the app can show. */
export class LegalDocuments {
  /** True for a known legal document id. */
  public static isLegalDocument(value: unknown): value is LegalDocument {
    return typeof value === 'string' && Object.hasOwn(LEGAL_DOCUMENTS, value);
  }
}


/**
 * Sections of the legal drafts, in reading order. Texts live under
 * legal.{document}.sections.{id}.{title|body} in the translation files.
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
} as const;

export type LegalDocument = keyof typeof LEGAL_DOCUMENTS;

/** LegalDocuments — the legal documents the app can show. */
export class LegalDocuments {
  /** True for a known legal document id. */
  public static isLegalDocument(value: unknown): value is LegalDocument {
    return value === 'terms' || value === 'privacy' || value === 'refunds';
  }
}


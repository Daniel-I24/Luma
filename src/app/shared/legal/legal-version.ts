/**
 * Versions of the legal texts accepted at sign-up (profiles.terms_version and
 * privacy_version, at most 20 characters each), shown on /legal. Change one
 * whenever its text changes; the pages are still drafts pending legal review.
 */
export const LEGAL_VERSIONS = {
  terms: '2026-10-draft',
  // Round 2: residence, optional photo and Wompi as payment processor.
  privacy: '2026-10-draft-r2',
  // Round 13: cancel until the kitchen starts (cancel_order), as the app already does.
  refunds: '2026-11-draft',
  // Round 8: how to delete the account and the data (public page for Meta).
  deletion: '2026-11-draft',
} as const;

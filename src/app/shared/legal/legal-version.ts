/**
 * Versions of the legal texts accepted at sign-up (profiles.terms_version and
 * privacy_version, at most 20 characters each), shown on /legal. Change one
 * whenever its text changes; the pages are still drafts pending legal review.
 */
export const LEGAL_VERSIONS = {
  terms: '2026-10-draft',
  privacy: '2026-10-draft',
} as const;

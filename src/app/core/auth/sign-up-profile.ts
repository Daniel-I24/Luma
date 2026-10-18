/**
 * What the stepped sign-up sends with the account (auth user metadata).
 * public.handle_new_user reads these keys, validates them again and never
 * blocks the sign-up; consent time and terms version are recorded by the
 * server only when accepted_terms is true.
 */
export interface SignUpProfile {
  readonly accountType: 'customer' | 'business_owner';
  readonly fullName: string;
  /** E.164 Colombian mobile (+573XXXXXXXXX) or null. */
  readonly phone: string | null;
  /** Terms, privacy policy and legal age, accepted together. */
  readonly acceptedTerms: boolean;
  readonly termsVersion: string;
}

/** Metadata keys as handle_new_user expects them. */
export function signUpMetadata(profile: SignUpProfile): Record<string, string | boolean | null> {
  return {
    account_type: profile.accountType,
    full_name: profile.fullName.trim(),
    phone: profile.phone,
    accepted_terms: profile.acceptedTerms,
    terms_version: profile.termsVersion,
  };
}

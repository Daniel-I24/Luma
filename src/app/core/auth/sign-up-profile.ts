import { TextNormalizer } from '@core/validation/text-normalizer';

/**
 * What the stepped sign-up sends with the account (auth user metadata).
 * public.handle_new_user reads these keys, validates them again and never
 * blocks the sign-up; each consent gets its own timestamp, set by the server
 * only when its flag is true.
 */
export interface SignUpProfile {
  readonly accountType: 'customer' | 'business_owner';
  readonly fullName: string;
  /** E.164 Colombian mobile (+573XXXXXXXXX) or null. */
  readonly phone: string | null;
  readonly acceptedTerms: boolean;
  readonly acceptedPrivacy: boolean;
  readonly confirmedAge: boolean;
  readonly termsVersion: string;
  readonly privacyVersion: string;
}

/** SignUpMetadata — the user metadata sent with a sign-up. */
export class SignUpMetadata {
  /** Metadata keys as handle_new_user expects them. */
  public static signUpMetadata(profile: SignUpProfile): Record<string, string | boolean | null> {
    return {
      account_type: profile.accountType,
      full_name: TextNormalizer.line(profile.fullName),
      phone: profile.phone,
      accepted_terms: profile.acceptedTerms,
      accepted_privacy: profile.acceptedPrivacy,
      confirmed_age: profile.confirmedAge,
      terms_version: profile.termsVersion,
      privacy_version: profile.privacyVersion,
    };
  }
}


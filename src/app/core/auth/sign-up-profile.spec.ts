import { describe, expect, it } from 'vitest';
import { SignUpMetadata } from './sign-up-profile';

describe('signUpMetadata', () => {
  it('uses the keys handle_new_user reads, with the name trimmed', () => {
    expect(
      SignUpMetadata.signUpMetadata({
        accountType: 'business_owner',
        fullName: '  Ana Pérez ',
        phone: '+573001234567',
        acceptedTerms: true,
        acceptedPrivacy: false,
        confirmedAge: true,
        termsVersion: '2026-10',
        privacyVersion: '2026-10p',
      }),
    ).toEqual({
      account_type: 'business_owner',
      full_name: 'Ana Pérez',
      phone: '+573001234567',
      accepted_terms: true,
      accepted_privacy: false,
      confirmed_age: true,
      terms_version: '2026-10',
      privacy_version: '2026-10p',
    });
  });
});

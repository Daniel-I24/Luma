import { describe, expect, it } from 'vitest';
import { signUpMetadata } from './sign-up-profile';

describe('signUpMetadata', () => {
  it('uses the keys handle_new_user reads, with the name trimmed', () => {
    expect(
      signUpMetadata({
        accountType: 'business_owner',
        fullName: '  Ana Pérez ',
        phone: '+573001234567',
        acceptedTerms: true,
        termsVersion: '2026-10',
      }),
    ).toEqual({
      account_type: 'business_owner',
      full_name: 'Ana Pérez',
      phone: '+573001234567',
      accepted_terms: true,
      terms_version: '2026-10',
    });
  });
});

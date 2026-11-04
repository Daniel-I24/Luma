import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PendingVerification } from '@core/auth/pending-verification';
import { LEGAL_VERSIONS } from '@shared/legal/legal-version';
import { SignupDraftStore } from '../../signup/signup-draft.store';
import { describe, expect, it, vi } from 'vitest';
import { registerPageHarness } from './register.page.harness';

describe('RegisterPage (stepped sign-up)', () => {
  const h = registerPageHarness();
  const { auth, completion, pasto, render } = h;

  it('walks the six steps, signs up with the profile metadata and holds residence and photo', async () => {
    auth.signUp.mockResolvedValue({ success: true });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { type, click, submit, title } = await render();

    await click('input[value="business_owner"]');
    await submit();
    expect(title()).toBe('auth.signup.steps.personal');
    expect(document.activeElement?.id).toBe('signup-step-title');

    await type('signup-fullName', 'Ana Pérez');
    await type('signup-phone', '300 123 4567');
    await submit();
    expect(title()).toBe('auth.signup.steps.residence');
    await submit();
    expect(title()).toBe('auth.signup.steps.residence');
    TestBed.inject(SignupDraftStore).update('residence', pasto);
    await submit();
    expect(title()).toBe('auth.signup.steps.photo');
    await submit();
    await type('signup-email', 'ana@example.com');
    await type('signup-password', 'tamal-pastuso-7');
    await submit();
    expect(title()).toBe('auth.signup.steps.consent');
    await click('#signup-acceptedTerms');
    await click('#signup-acceptedPrivacy');
    await click('#signup-isAdult');
    await submit();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(['/auth/verify']));
    expect(auth.signUp).toHaveBeenCalledWith('ana@example.com', 'tamal-pastuso-7', {
      accountType: 'business_owner',
      fullName: 'Ana Pérez',
      phone: '+573001234567',
      acceptedTerms: true,
      acceptedPrivacy: true,
      confirmedAge: true,
      termsVersion: LEGAL_VERSIONS.terms,
      privacyVersion: LEGAL_VERSIONS.privacy,
    });
    expect(TestBed.inject(PendingVerification).email()).toBe('ana@example.com');
    expect(completion.hold).toHaveBeenCalledWith(expect.objectContaining({ residence: pasto, avatar: null, phone: '300 123 4567' }));
    expect(TestBed.inject(SignupDraftStore).draft().password).toBe('');
  });
});

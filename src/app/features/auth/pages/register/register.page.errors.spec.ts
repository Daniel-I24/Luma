import { TestBed } from '@angular/core/testing';
import { SignupDraftStore } from '../../signup/signup-draft.store';
import { describe, expect, it, vi } from 'vitest';
import { registerPageHarness } from './register.page.harness';

describe('RegisterPage: errors and going back', () => {
  const h = registerPageHarness();
  const { auth, pasto, render } = h;

  it('shows the errors of a step and focuses the first invalid field', async () => {
    const { el, click, submit } = await render();
    await click('input[value="business_owner"]');
    await submit();

    await submit();

    expect(document.activeElement?.id).toBe('signup-fullName');
    expect(el.textContent).toContain('validation.required');
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('keeps the typed data when going back', async () => {
    const { el, type, click, submit, settle, title } = await render();
    await click('input[value="customer"]');
    await submit();
    await type('signup-fullName', 'Ana Pérez');
    await type('signup-phone', '300 123 4567');
    await submit();

    const back = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('auth.signup.back'),
    )!;
    back.click();
    await settle();

    expect(title()).toBe('auth.signup.steps.personal');
    expect(el.querySelector<HTMLInputElement>('#signup-fullName')!.value).toBe('Ana Pérez');
  });

  it('shows a translated error and stays on the last step when the sign-up fails', async () => {
    auth.signUp.mockResolvedValue({ success: false, errorKey: 'auth.errors.tooManyRequests' });
    const store = TestBed.inject(SignupDraftStore);
    const { el, submit } = await render();
    store.update('accountType', 'customer');
    store.update('fullName', 'Ana');
    store.update('phone', '300 123 4567');
    store.update('residence', pasto);
    store.update('email', 'ana@example.com');
    store.update('password', 'Tamal2024');
    store.update('acceptedTerms', true);
    store.update('acceptedPrivacy', true);
    store.update('isAdult', true);
    for (let i = 0; i < 5; i++) await submit();

    await submit();

    await vi.waitFor(() =>
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        'auth.errors.tooManyRequests',
      ),
    );
    expect(store.isLast()).toBe(true);
  });
});

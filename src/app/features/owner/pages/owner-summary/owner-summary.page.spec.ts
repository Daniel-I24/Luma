import { describe, expect, it, vi } from 'vitest';
import { ownerSummaryPageHarness } from './owner-summary.page.harness';

describe('OwnerSummaryPage', () => {
  const h = ownerSummaryPageHarness();
  const { verification, render } = h;

  it('"Verifica tu negocio, paso 1 de 3": three tappable steps with why, what is missing and "Completar" to the exact screen', async () => {
    const { el, button } = await render({ phone: null });

    expect(el.querySelector('#verification-title')?.textContent).toContain('owner.verification.progress');
    expect(el.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1');
    const steps = Array.from(el.querySelectorAll<HTMLAnchorElement>('#review-missing a')).map((a) => [
      a.dataset['step'],
      a.getAttribute('href'),
      a.textContent?.includes('owner.verification.complete') ? 'completar' : 'listo',
    ]);
    expect(steps).toEqual([
      ['business', '/owner/b1/business/info', 'completar'],
      ['operation', '/owner/b1/business/hours', 'listo'],
      ['legal', '/owner/b1/business/verification', 'completar'],
    ]);
    expect(el.textContent).toContain('owner.verification.requirements.phone');
    expect(el.textContent).toContain('owner.verification.steps.business.why');
    expect(el.textContent).toContain('owner.verification.privacy');
    expect(el.textContent).toContain('owner.verification.time');
    expect(button('owner.verification.submit')?.disabled).toBe(true);
    expect(el.querySelector('#review-blocked')?.textContent).toContain('owner.verification.submitBlocked');
    expect(el.textContent).not.toContain('businessPanel.dashboard.publishTitle');
  });

  it('submits a complete draft and shows it under review', async () => {
    verification.getLegal.mockResolvedValue({ data: { tax_id: '800197268-4' }, errorKey: null });
    verification.listDocs.mockResolvedValue({
      data: [{ kind: 'rut' }, { kind: 'facade' }],
      errorKey: null,
    });
    verification.submit.mockResolvedValue({ data: { ok: true, missing: [] }, errorKey: null });
    const { fixture, el, button } = await render();

    button('owner.verification.submit')!.click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.textContent).toContain('verification.status.pending');
    });
    expect(verification.submit).toHaveBeenCalledWith('b1');
  });

  it('shows the team note and the way to fix a rejected business', async () => {
    const { el } = await render({
      verification_status: 'rejected',
      verification_note: 'Falta el RUT legible',
    });

    expect(el.textContent).toContain('Falta el RUT legible');
    expect(el.textContent).toContain('owner.verification.fix');
    expect(el.textContent).toContain('owner.verification.resubmit');
  });
});

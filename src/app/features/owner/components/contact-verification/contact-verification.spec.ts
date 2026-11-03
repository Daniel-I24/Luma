import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SUPPORT_WHATSAPP } from '@core/config/support';
import type { Business } from '@shared/business/models/business.model';
import { ContactVerificationRepository } from '@shared/business/verification/contact-verification.repository';
import { ContactVerificationCard } from './contact-verification';

const business = {
  id: 'b1',
  phone: '+573001112233',
  phone_verified_at: '2026-10-01T00:00:00Z',
  whatsapp: '+573004445566',
  instagram: 'cafe.publico',
  website: 'https://cafe.co/',
} as Business;

describe('ContactVerificationCard', () => {
  const repo = { listMine: vi.fn(), request: vi.fn() };

  function setup(support = '573009990000') {
    TestBed.configureTestingModule({
      imports: [
        ContactVerificationCard,
        TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } }),
      ],
      providers: [
        { provide: ContactVerificationRepository, useValue: repo },
        { provide: SUPPORT_WHATSAPP, useValue: support },
      ],
    });
  }

  async function render() {
    const fixture = TestBed.createComponent(ContactVerificationCard);
    fixture.componentRef.setInput('business', business);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    repo.listMine.mockResolvedValue({
      data: [
        { id: 'r1', kind: 'whatsapp', value: '+573004445566', code: 'LUMA-AB12CD', status: 'pending', requested_at: 'x' },
        { id: 'r2', kind: 'instagram', value: 'old.handle', code: 'LUMA-000000', status: 'pending', requested_at: 'x' },
      ],
      errorKey: null,
    });
    repo.request.mockResolvedValue({ data: 'LUMA-FF00AA', errorKey: null });
  });

  it('shows each contact verified or pending, with the code and its steps', async () => {
    setup();
    const el = await render();
    const rows = Array.from(el.querySelectorAll('article'));

    expect(rows).toHaveLength(4);
    expect(rows[0].textContent).toContain('contactVerification.verified');
    expect(rows[1].textContent).toContain('LUMA-AB12CD');
    expect(rows[1].querySelector('a')?.getAttribute('href')).toBe('https://wa.me/573009990000?text=LUMA-AB12CD');
    // A request for an old value does not count: the owner asks again.
    expect(rows[2].textContent).toContain('contactVerification.request');
    expect(rows[3].textContent).toContain('contactVerification.request');
  });

  it('without SUPPORT_WHATSAPP the step says it is not configured yet', async () => {
    setup('');
    const el = await render();

    expect(el.textContent).toContain('contactVerification.steps.noSupport');
    expect(el.querySelector('a[href^="https://wa.me"]')).toBeNull();
  });

  it('asks for a code and reloads the requests', async () => {
    setup();
    const el = await render();
    const button = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('contactVerification.request'))!;
    button.click();
    await vi.waitFor(() => expect(repo.request).toHaveBeenCalledWith('b1', 'instagram'));
    expect(repo.listMine).toHaveBeenCalledTimes(2);
  });
});

import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SUPPORT_WHATSAPP } from '@core/config/build-flags';
import type { Business } from '@shared/business/models/business.model';
import type { ContactVerification } from '@shared/business/verification/contact-verification';
import { ContactVerificationRepository } from '@shared/business/verification/contact-verification.repository';
import { ContactVerificationCard } from './contact-verification';

const business = { id: 'b1', instagram: 'cafe.publico', website: 'https://cafe.co' } as Business;
const request = (kind: string, status: ContactVerification['status'], extra: Partial<ContactVerification> = {}) =>
  ({ id: `r-${kind}-${status}`, kind, value: kind === 'website' ? 'https://cafe.co' : 'cafe.publico', code: 'LUMA-IG0001',
     status, requested_at: 'x', verified_at: null, reject_reason: null, ...extra });

/** The four states the owner sees ("Sin verificar", "En revisión", "Verificado", "Rechazado"). */
describe('ContactVerificationCard states', () => {
  const repo = { listMine: vi.fn(), request: vi.fn(), config: vi.fn().mockResolvedValue({}), checkWebsite: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.config.mockResolvedValue({});
    TestBed.configureTestingModule({
      imports: [ContactVerificationCard, TranslocoTestingModule.forRoot({ langs: { es: {} } })],
      providers: [
        { provide: ContactVerificationRepository, useValue: repo },
        { provide: SUPPORT_WHATSAPP, useValue: '' },
      ],
    });
  });

  async function render(requests: unknown[]) {
    repo.listMine.mockResolvedValue({ data: requests, errorKey: null });
    const fixture = TestBed.createComponent(ContactVerificationCard);
    fixture.componentRef.setInput('business', business);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('article'));
    return { fixture, row: (kind: string) => rows.find((a) => a.textContent?.includes(`kind.${kind}`))! };
  }

  it('nothing sent: "Sin verificar" and the button to ask, never "En revisión"', async () => {
    const { row } = await render([]);
    expect(row('instagram').textContent).toContain('contactVerification.state.unverified');
    expect(row('instagram').textContent).not.toContain('contactVerification.state.review');
    expect(row('instagram').querySelector('button')?.textContent).toContain('contactVerification.request');
  });

  it('asking turns it "En revisión" with the code to publish', async () => {
    const { fixture, row } = await render([]);
    repo.request.mockResolvedValue({ data: 'LUMA-IG0001', errorKey: null });
    repo.listMine.mockResolvedValue({ data: [request('instagram', 'pending')], errorKey: null });
    row('instagram').querySelector('button')!.click();
    await vi.waitFor(() => expect(repo.request).toHaveBeenCalledWith('b1', 'instagram'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(row('instagram').textContent).toContain('contactVerification.state.review');
    expect(row('instagram').textContent).toContain('LUMA-IG0001');
    expect(row('instagram').querySelector('button')).toBeNull();
  });

  it('rejected: the reason of the team and "Solicitar de nuevo"', async () => {
    const { row } = await render([request('instagram', 'rejected', { verified_at: 'y', reject_reason: 'No vimos el código.' })]);
    expect(row('instagram').textContent).toContain('contactVerification.state.rejected');
    expect(row('instagram').textContent).toContain('contactVerification.rejectedBecause');
    expect(row('instagram').querySelector('button')?.textContent).toContain('contactVerification.requestAgain');
  });

  it('verified: the badge and nothing to do', async () => {
    const { row } = await render([request('website', 'verified', { verified_at: 'y' })]);
    expect(row('website').textContent).toContain('contactVerification.state.verified');
    expect(row('website').querySelector('button')).toBeNull();
  });
});

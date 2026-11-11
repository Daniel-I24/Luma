import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SUPPORT_WHATSAPP } from '@core/config/build-flags';
import type { Business } from '@shared/business/models/business.model';
import { ContactVerificationRepository } from '@shared/business/verification/contact-verification.repository';
import { ContactVerificationCard, WATCH_EVERY_MS, WATCH_FOR_MS } from './contact-verification';

const business = {
  id: 'b1',
  phone: '+57 601 234 5678',
  whatsapp: '+573004445566',
  instagram: 'cafe.publico',
  website: 'https://cafe.co/menu',
} as Business;
const pending = (kind: string, value: string, code: string, status = 'pending') =>
  ({ id: `r-${kind}`, kind, value, code, status, requested_at: 'x', verified_at: null, reject_reason: null });
const AUTO = { phone: 'whatsapp', whatsapp: 'whatsapp', website: 'website', instagram: 'manual', facebook: 'manual' };

describe('ContactVerificationCard with the automatic strategies', () => {
  const repo = { listMine: vi.fn(), request: vi.fn(), config: vi.fn(), checkWebsite: vi.fn() };

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
    const el = fixture.nativeElement as HTMLElement;
    const row = (kind: string) => Array.from(el.querySelectorAll('article')).find((a) => a.textContent?.includes(`kind.${kind}`))!;
    return { fixture, el, row };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    repo.config.mockResolvedValue(AUTO);
    repo.listMine.mockResolvedValue({
      data: [
        pending('whatsapp', '+573004445566', 'LUMA-AB12CD'),
        pending('instagram', 'cafe.publico', 'LUMA-IG0001'),
        pending('website', 'https://cafe.co/menu', 'LUMA-WEB001'),
      ],
      errorKey: null,
    });
    repo.checkWebsite.mockResolvedValue({ verified: false, reasonKey: 'contactVerification.website.mismatch' });
  });
  afterEach(() => vi.useRealTimers());

  it('WhatsApp: "Verificar con WhatsApp" opens the support chat with the code and watches the state', async () => {
    setup();
    const { fixture, row } = await render();
    vi.useFakeTimers();
    const link = row('whatsapp').querySelector('a')!;
    expect(link.textContent).toContain('contactVerification.verifyWithWhatsapp');
    expect(link.getAttribute('href')).toBe('https://wa.me/573009990000?text=LUMA-AB12CD');
    expect(row('whatsapp').textContent).toContain('contactVerification.steps.whatsappAuto');

    link.dispatchEvent(new MouseEvent('click', { cancelable: true }));
    repo.listMine.mockResolvedValue({ data: [pending('whatsapp', '+573004445566', 'LUMA-AB12CD', 'verified')], errorKey: null });
    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS);
    fixture.detectChanges();
    expect(row('whatsapp').textContent).toContain('contactVerification.state.verified');
    const reads = repo.listMine.mock.calls.length;
    await vi.advanceTimersByTimeAsync(WATCH_FOR_MS);
    expect(repo.listMine.mock.calls.length).toBe(reads);
  });

  it('stops watching after 2 minutes without an answer', async () => {
    setup();
    const { row } = await render();
    vi.useFakeTimers();
    row('whatsapp').querySelector('a')!.dispatchEvent(new MouseEvent('click', { cancelable: true }));
    await vi.advanceTimersByTimeAsync(WATCH_FOR_MS + WATCH_EVERY_MS);
    const reads = repo.listMine.mock.calls.length;
    await vi.advanceTimersByTimeAsync(WATCH_FOR_MS);
    expect(repo.listMine.mock.calls.length).toBe(reads);
  });

  it('without the support WhatsApp (SUPPORT_WHATSAPP) the cause and the next step show: it waits for the team', async () => {
    setup('');
    const { row } = await render();
    expect(row('whatsapp').textContent).toContain('contactVerification.steps.noSupport');
    expect(row('whatsapp').querySelector('a')).toBeNull();
  });

  it('two minutes without the message: explained (webhook not set up), and the request waits for review', async () => {
    setup();
    const { fixture, row } = await render();
    vi.useFakeTimers();
    row('whatsapp').querySelector('a')!.dispatchEvent(new MouseEvent('click', { cancelable: true }));
    await vi.advanceTimersByTimeAsync(WATCH_FOR_MS + WATCH_EVERY_MS);
    fixture.detectChanges();
    expect(row('whatsapp').textContent).toContain('contactVerification.steps.watchTimeout');
  });

  it('a landline is explained, without a request button nor a badge', async () => {
    setup();
    const { row } = await render();
    expect(row('phone').textContent).toContain('contactVerification.steps.landline');
    expect(row('phone').querySelector('button')).toBeNull();
    expect(row('phone').textContent).not.toContain('contactVerification.state.');
  });

  it('website: the file at /.well-known and "Comprobar ahora" with its answer', async () => {
    setup();
    const { fixture, row } = await render();
    expect(row('website').textContent).toContain('contactVerification.steps.websiteAuto');
    row('website').querySelector('button')!.click();
    await vi.waitFor(() => expect(repo.checkWebsite).toHaveBeenCalledWith('b1'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(row('website').textContent).toContain('contactVerification.website.mismatch');
  });

  it('Instagram stays with the admin queue while the automatic strategies are on', async () => {
    setup();
    const { row } = await render();
    expect(row('instagram').textContent).toContain('contactVerification.steps.social');
    expect(row('instagram').textContent).toContain('contactVerification.steps.review');
  });

  it('with the automatic strategies off (or no answer) everything falls back to the queue', async () => {
    repo.config.mockResolvedValue({});
    setup();
    const { row } = await render();
    expect(row('whatsapp').textContent).toContain('contactVerification.openWhatsapp');
    expect(row('whatsapp').textContent).toContain('contactVerification.steps.autoOff');
    expect(row('website').textContent).toContain('contactVerification.steps.website');
    expect(row('website').querySelector('button')).toBeNull();
  });
});

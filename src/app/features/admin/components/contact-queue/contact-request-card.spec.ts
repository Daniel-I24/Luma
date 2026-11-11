import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import type { ContactKind, PendingContactVerification } from '@shared/business/verification/contact-verification';
import type { ContactDecision } from '@shared/business/verification/contact-verification.repository';
import { ContactRequestCard } from './contact-request-card';

const item = (kind: ContactKind, value: string): PendingContactVerification =>
  ({ id: 'r1', business_id: 'b1', business_name: 'Café Público', kind, value, code: 'LUMA-IG0001', requested_at: 'x' });

function render(request: PendingContactVerification) {
  TestBed.configureTestingModule({ imports: [ContactRequestCard, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })] });
  const fixture = TestBed.createComponent(ContactRequestCard);
  fixture.componentRef.setInput('item', request);
  const decided: ContactDecision[] = [];
  fixture.componentInstance.decided.subscribe((d) => decided.push(d));
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const button = (key: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(key))!;
  const links = () => Array.from(el.querySelectorAll('a')).map((a) => [a.textContent?.trim(), a.getAttribute('href')]);
  return { fixture, el, decided, button, links };
}

describe('ContactRequestCard', () => {
  it('Instagram: a link to the profile, opened apart from the app', () => {
    const { el, links } = render(item('instagram', 'cafe.publico'));
    expect(links()).toEqual([['admin.contacts.openInstagram', 'https://instagram.com/cafe.publico']]);
    expect(el.querySelector('a')?.getAttribute('rel')).toContain('noopener');
  });

  it('website: the site and its verification file', () => {
    const { links } = render(item('website', 'https://cafe.co/menu'));
    expect(links()).toEqual([
      ['admin.contacts.openWebsite', 'https://cafe.co/menu'],
      ['admin.contacts.openFile', 'https://cafe.co/.well-known/luma-verification.txt'],
    ]);
  });

  it('a website that is not http(s) gets no link', () => {
    const { links } = render(item('website', 'javascript:alert(1)'));
    expect(links()).toEqual([]);
  });

  it('phone: checked in the support chat, no link', () => {
    const { el, links } = render(item('phone', '+573001112233'));
    expect(links()).toEqual([]);
    expect(el.textContent).toContain('admin.contacts.checkChat');
  });

  it('"Verificar" decides at once', () => {
    const { button, decided } = render(item('instagram', 'cafe.publico'));
    button('admin.contacts.verify').click();
    expect(decided).toEqual([{ status: 'verified' }]);
  });

  it('"Rechazar" asks for the reason first and refuses one too short', () => {
    const { fixture, el, button, decided } = render(item('instagram', 'cafe.publico'));
    button('admin.contacts.reject').click();
    fixture.detectChanges();
    const field = el.querySelector('input')!;
    field.value = ' no ';
    field.dispatchEvent(new Event('input'));
    button('admin.contacts.confirmReject').click();
    fixture.detectChanges();
    expect(decided).toEqual([]);
    expect(el.textContent).toContain('admin.contacts.reasonRequired');

    field.value = '  No encontramos el código en la biografía.  ';
    field.dispatchEvent(new Event('input'));
    button('admin.contacts.confirmReject').click();
    expect(decided).toEqual([{ status: 'rejected', reason: 'No encontramos el código en la biografía.' }]);
  });

  it('cancelling the rejection goes back to both buttons', () => {
    const { fixture, el, button } = render(item('instagram', 'cafe.publico'));
    button('admin.contacts.reject').click();
    fixture.detectChanges();
    button('admin.review.cancel').click();
    fixture.detectChanges();
    expect(el.querySelector('input')).toBeNull();
    expect(button('admin.contacts.verify')).toBeTruthy();
  });
});

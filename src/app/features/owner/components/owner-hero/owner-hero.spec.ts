import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { OwnerReturnBanner } from '@shared/layout/owner-return-banner/owner-return-banner';
import { OwnerHero } from './owner-hero';

const translations = TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } });

describe('Compact headers (round 8)', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [OwnerHero, OwnerReturnBanner, translations],
      providers: [provideRouter([]), { provide: SessionProfileStore, useValue: { isBusinessOwner: signal(true) } }],
    });
  }

  it('the portada invites to add the logo and the cover when they are missing', () => {
    setup();
    const fixture = TestBed.createComponent(OwnerHero);
    fixture.componentRef.setInput('business', { id: 'b1', name: 'Café', logo_url: null, cover_url: null, verification_status: 'approved' });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a[aria-label="owner.hero.addLogo"]')?.getAttribute('href')).toBe('/owner/b1/business/info');
    expect(el.textContent).toContain('owner.hero.addCover');
    expect(el.querySelector('h1')?.textContent).toContain('Café');
  });

  it('"Estás viendo Luma como cliente" fits one line with "Volver"', () => {
    setup();
    const fixture = TestBed.createComponent(OwnerReturnBanner);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="note"]')?.textContent).toContain('owner.customerView.banner');
    expect(el.querySelector('a')?.textContent).toContain('owner.customerView.back');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/owner');
  });
});

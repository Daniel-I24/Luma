import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import { LEGAL_DOCUMENTS } from './legal-documents';
import { legalRoutes } from './legal.routes';

describe('LegalDocumentPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [provideRouter([{ path: 'legal', children: legalRoutes }])],
    });
  });

  for (const document of ['terms', 'privacy'] as const) {
    it(`renders every ${document} section under the draft notice`, async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(`/legal/${document}`);
      const el = harness.routeNativeElement!;

      // One "Legal" screen: the document is its selected tab (round 8).
      expect(el.querySelector('h1')?.textContent).toContain('profile.help.legal');
      const tabs = Array.from(el.querySelectorAll('[role="tab"]'));
      expect(tabs.map((tab) => tab.id)).toEqual(['legal-tab-terms', 'legal-tab-privacy', 'legal-tab-refunds']);
      expect(el.querySelector(`#legal-tab-${document}`)?.getAttribute('aria-selected')).toBe('true');
      expect(el.querySelector('[role="note"]')?.textContent).toContain('legal.draftNotice');
      expect(
        Array.from(el.querySelectorAll('section h2')).map((h) => h.textContent?.trim()),
      ).toEqual(LEGAL_DOCUMENTS[document].map((s) => `legal.${document}.sections.${s}.title`));
    });
  }
});

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

      expect(el.querySelector('h1')?.textContent).toContain(`legal.${document}.title`);
      expect(el.querySelector('[role="note"]')?.textContent).toContain('legal.draftNotice');
      expect(
        Array.from(el.querySelectorAll('section h2')).map((h) => h.textContent?.trim()),
      ).toEqual(LEGAL_DOCUMENTS[document].map((s) => `legal.${document}.sections.${s}.title`));
    });
  }
});

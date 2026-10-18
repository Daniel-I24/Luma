import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { BusinessEntry } from './business-entry';

describe('BusinessEntry', () => {
  it('takes owners back to Luma Negocios', () => {
    TestBed.configureTestingModule({
      imports: [
        BusinessEntry,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(BusinessEntry);
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a')!;

    expect(link.getAttribute('href')).toBe('/owner');
    expect(link.textContent).toContain('owner.brand');
  });
});

import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { AccountTypeStep } from './account-type-step';

describe('AccountTypeStep', () => {
  it('only the first option has the field id; the others have none (never id="null")', () => {
    TestBed.configureTestingModule({
      imports: [AccountTypeStep, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
    });
    const fixture = TestBed.createComponent(AccountTypeStep);
    fixture.detectChanges();
    const radios = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('input[type="radio"]'));
    expect(radios.length).toBeGreaterThan(1);
    expect(radios.map((r) => r.getAttribute('id'))).toEqual(['signup-accountType', ...radios.slice(1).map(() => null)]);
  });
});

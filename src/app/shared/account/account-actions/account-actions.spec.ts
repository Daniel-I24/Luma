import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { AccountActions } from './account-actions';

describe('AccountActions: "Mis datos"', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AccountActions, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { loading: signal(false), user: signal({ id: 'u1', email: 'ana@example.test' }) } },
      ],
    });
  });

  it('leads to the page that explains it, and starts no download by itself', () => {
    const fixture = TestBed.createComponent(AccountActions);
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a[href="/account/data"]');
    expect(link?.textContent).toContain('account.data.title');
  });
});

import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageService } from './language.service';

function setup() {
  const transloco = {
    load: vi.fn<(lang: string) => Observable<object>>(() => of({})),
    setActiveLang: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [LanguageService, { provide: TranslocoService, useValue: transloco }],
  });
  return { service: TestBed.inject(LanguageService), transloco };
}

describe('LanguageService', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
  });

  it('defaults to Spanish', () => {
    const { service } = setup();

    expect(service.language()).toBe('es');
  });

  it('restores a persisted language', () => {
    localStorage.setItem('luma-lang', 'en');
    const { service } = setup();

    expect(service.language()).toBe('en');
  });

  it('falls back to Spanish for an invalid stored value', () => {
    localStorage.setItem('luma-lang', 'fr');
    const { service } = setup();

    expect(service.language()).toBe('es');
  });

  it('init loads the translations before activating the language', async () => {
    localStorage.setItem('luma-lang', 'en');
    const { service, transloco } = setup();

    await service.init();

    expect(transloco.load).toHaveBeenCalledWith('en');
    expect(transloco.setActiveLang).toHaveBeenCalledWith('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('init still activates the language when loading fails', async () => {
    const { service, transloco } = setup();
    transloco.load.mockReturnValue(throwError(() => new Error('offline')));

    await expect(service.init()).resolves.toBeUndefined();

    expect(transloco.setActiveLang).toHaveBeenCalledWith('es');
  });

  it('setLanguage switches Transloco, the html lang and persists the choice', () => {
    const { service, transloco } = setup();

    service.setLanguage('en');

    expect(service.language()).toBe('en');
    expect(transloco.setActiveLang).toHaveBeenCalledWith('en');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('luma-lang')).toBe('en');
  });
});

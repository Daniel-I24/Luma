import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageService } from '@core/i18n/language.service';
import type { Language } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import type { Theme } from '@core/theme/theme.service';
import { AppearanceSettings } from './appearance-settings';

const theme = (name: string, description: string) => ({ name, description });
const ES = {
  profile: {
    appearance: {
      title: 'Apariencia',
      theme: 'Tema visual',
      language: 'Idioma',
      themes: {
        ciruela: theme('Ciruela sobria', 'Oscuro'),
        crema: theme('Crema clara', 'Claro'),
      },
      languages: { es: 'Español', en: 'English' },
    },
  },
};

describe('AppearanceSettings', () => {
  const languageService = { language: signal<Language>('es'), setLanguage: vi.fn() };
  const themeService = { theme: signal<Theme>('ciruela'), setTheme: vi.fn() };
  let el: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [
        AppearanceSettings,
        TranslocoTestingModule.forRoot({
          langs: { es: ES },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        { provide: LanguageService, useValue: languageService },
        { provide: ThemeService, useValue: themeService },
      ],
    });
    const fixture = TestBed.createComponent(AppearanceSettings);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  const radio = (name: string, value: string) =>
    el.querySelector(`input[name="${name}"][value="${value}"]`) as HTMLInputElement;

  it('shows the active theme and language in the collapsed rows', () => {
    const rows = Array.from(el.querySelectorAll('button')).map((b) => b.textContent);

    expect(rows[0]).toContain('Ciruela sobria');
    expect(rows[1]).toContain('Español');
  });

  it('offers the two themes and checks the active one', () => {
    expect(el.querySelectorAll('input[name="theme"]')).toHaveLength(2);
    expect(radio('theme', 'ciruela').checked).toBe(true);
  });

  it('applies a theme when its option is chosen', () => {
    radio('theme', 'crema').click();

    expect(themeService.setTheme).toHaveBeenCalledWith('crema');
  });

  it('switches the language when its option is chosen', () => {
    radio('language', 'en').click();

    expect(languageService.setLanguage).toHaveBeenCalledWith('en');
  });
});

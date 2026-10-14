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
        indigo: theme('Indigo', 'Principal'),
        midnight: theme('Midnight', 'Oscuro'),
        pearl: theme('Pearl', 'Minimalista'),
        sunset: theme('Sunset', 'Energético'),
      },
      languages: { es: 'Español', en: 'English' },
    },
  },
};

describe('AppearanceSettings', () => {
  const languageService = { language: signal<Language>('es'), setLanguage: vi.fn() };
  const themeService = { theme: signal<Theme>('indigo'), setTheme: vi.fn() };
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

    expect(rows[0]).toContain('Indigo');
    expect(rows[1]).toContain('Español');
  });

  it('offers the four themes and checks the active one', () => {
    expect(el.querySelectorAll('input[name="theme"]')).toHaveLength(4);
    expect(radio('theme', 'indigo').checked).toBe(true);
  });

  it('applies a theme when its option is chosen', () => {
    radio('theme', 'sunset').click();

    expect(themeService.setTheme).toHaveBeenCalledWith('sunset');
  });

  it('switches the language when its option is chosen', () => {
    radio('language', 'en').click();

    expect(languageService.setLanguage).toHaveBeenCalledWith('en');
  });
});

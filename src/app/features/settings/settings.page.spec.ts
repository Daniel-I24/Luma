import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageService } from '@core/i18n/language.service';
import type { Language } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import type { Theme } from '@core/theme/theme.service';
import { SettingsPage } from './settings.page';

const ES = {
  settings: {
    title: 'Ajustes',
    language: { title: 'Idioma', es: 'Español', en: 'English' },
    theme: {
      title: 'Tema',
      indigo: 'Índigo',
      midnight: 'Medianoche',
      pearl: 'Perla',
      sunset: 'Atardecer',
    },
    account: { title: 'Cuenta', profile: 'Ver mi perfil' },
  },
};

describe('SettingsPage', () => {
  const language = signal<Language>('es');
  const theme = signal<Theme>('indigo');
  const languageService = { language, setLanguage: vi.fn() };
  const themeService = { theme, setTheme: vi.fn() };
  let el: HTMLElement;

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [
        SettingsPage,
        TranslocoTestingModule.forRoot({
          langs: { es: ES },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: LanguageService, useValue: languageService },
        { provide: ThemeService, useValue: themeService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  function button(label: string): HTMLButtonElement {
    const match = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label,
    );
    if (!match) throw new Error(`Button "${label}" not found`);
    return match;
  }

  it('shows both languages and marks the active one as pressed', () => {
    expect(button('Español').getAttribute('aria-pressed')).toBe('true');
    expect(button('English').getAttribute('aria-pressed')).toBe('false');
  });

  it('switches the language through LanguageService', () => {
    button('English').click();

    expect(languageService.setLanguage).toHaveBeenCalledWith('en');
  });

  it('shows the four themes and marks the active one as pressed', () => {
    const labels = ['Índigo', 'Medianoche', 'Perla', 'Atardecer'];

    expect(labels.map((l) => button(l).getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ]);
  });

  it('switches the theme through ThemeService', () => {
    button('Atardecer').click();

    expect(themeService.setTheme).toHaveBeenCalledWith('sunset');
  });

  it('links to the profile page', () => {
    const link = el.querySelector('a.settings-link');

    expect(link?.getAttribute('href')).toBe('/profile');
    expect(link?.textContent?.trim()).toBe('Ver mi perfil');
  });
});

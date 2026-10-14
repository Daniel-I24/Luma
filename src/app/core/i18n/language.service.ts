import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

/** Supported interface languages. */
export type Language = 'es' | 'en';

export const LANGUAGES: readonly Language[] = ['es', 'en'];

const STORAGE_KEY = 'luma-lang';
const DEFAULT_LANGUAGE: Language = 'es';

function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}

/**
 * LanguageService — owns the active interface language: restores it from
 * localStorage, applies it to Transloco and <html lang>, and persists changes.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  private readonly _language = signal<Language>(this.readStored());

  /** Readonly signal with the active language. */
  readonly language = computed(() => this._language());

  /**
   * Loads the stored language's translations and activates it.
   * Meant for app initialization so the first render is already translated.
   */
  async init(): Promise<void> {
    const language = this._language();
    try {
      await firstValueFrom(this.transloco.load(language));
    } catch {
      // Never block bootstrap: Transloco retries loading on first render.
    }
    this.apply(language);
  }

  /** Switches the language at runtime and persists the choice. */
  setLanguage(language: Language): void {
    this._language.set(language);
    this.apply(language);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Storage may be unavailable (private browsing); the change still applies.
    }
  }

  private apply(language: Language): void {
    this.transloco.setActiveLang(language);
    this.document.documentElement.lang = language;
  }

  private readStored(): Language {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
    } catch {
      return DEFAULT_LANGUAGE;
    }
  }
}

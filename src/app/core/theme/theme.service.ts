import { Injectable, signal, computed, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Supported visual themes. */
export type Theme = 'indigo' | 'midnight' | 'pearl' | 'sunset';

const STORAGE_KEY = 'luma-theme';
const DEFAULT_THEME: Theme = 'indigo';
const VALID_THEMES: readonly Theme[] = ['indigo', 'midnight', 'pearl', 'sunset'];

function isValidTheme(value: unknown): value is Theme {
  return VALID_THEMES.includes(value as Theme);
}

/**
 * ThemeService — singleton that manages the active visual theme.
 *
 * - Reads the persisted theme from localStorage on startup.
 * - Exposes a readonly Signal<Theme> for reactive consumers.
 * - Applies `data-theme` on <html> synchronously to prevent FOUC.
 * - Persists every change to localStorage.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly _theme = signal<Theme>(this.resolveInitialTheme());

  /** Readonly signal with the currently active theme. */
  readonly theme = computed(() => this._theme());

  constructor() {
    // Keep the DOM attribute in sync with the signal value.
    effect(() => {
      this.applyToDom(this._theme());
    });
  }

  /** Change the active theme, persist it, and update the DOM. */
  setTheme(theme: Theme): void {
    this._theme.set(theme);
    if (this.isBrowser) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // localStorage may be unavailable in private browsing.
      }
    }
  }

  // ── Private helpers ────────────────────────────────────────────────

  private resolveInitialTheme(): Theme {
    if (!this.isBrowser) return DEFAULT_THEME;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isValidTheme(stored)) return stored;
    } catch {
      // Ignore storage errors.
    }

    return DEFAULT_THEME;
  }

  private applyToDom(theme: Theme): void {
    if (!this.isBrowser) return;

    const html = document.documentElement;
    if (theme === DEFAULT_THEME) {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', theme);
    }
  }
}

import { Injectable, effect, inject, signal } from '@angular/core';
import { ThemeService } from '@core/theme/theme.service';
import type { Theme } from '@core/theme/theme.service';
import { NativeStatusBar } from './native-status-bar';

const DARK_THEMES: readonly Theme[] = ['midnight'];

/**
 * StatusBarThemeService — on native platforms, draws the app under the
 * status bar (safe areas handle the inset) and keeps its icons readable for
 * the active theme. No-op on the web.
 */
@Injectable({ providedIn: 'root' })
export class StatusBarThemeService {
  private readonly statusBar = inject(NativeStatusBar);
  private readonly theme = inject(ThemeService).theme;
  private readonly native = signal(false);

  constructor() {
    void this.detect();
    effect(() => {
      if (!this.native()) return;
      const content = DARK_THEMES.includes(this.theme()) ? 'light-content' : 'dark-content';
      void this.run(() => this.statusBar.setContent(content));
    });
  }

  private async detect(): Promise<void> {
    if (!(await this.statusBar.isAvailable())) return;
    await this.run(() => this.statusBar.overlayWebView());
    this.native.set(true);
  }

  private async run(call: () => Promise<void>): Promise<void> {
    try {
      await call();
    } catch {
      // Cosmetic only: a status bar failure must never break the app.
    }
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LANGUAGES, LanguageService } from '@core/i18n/language.service';
import type { Language } from '@core/i18n/language.service';
import { THEMES, ThemeService } from '@core/theme/theme.service';
import type { Theme } from '@core/theme/theme.service';
import { LumaButton, LumaCard } from '@design-system';

/**
 * SettingsPage — /settings (protected by authGuard).
 * Lets the user pick the interface language and visual theme, and links to
 * the profile.
 */
@Component({
  selector: 'app-settings-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoModule, LumaButton, LumaCard],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.css',
})
export class SettingsPage {
  private readonly languageService = inject(LanguageService);
  private readonly themeService = inject(ThemeService);

  protected readonly languages = LANGUAGES;
  protected readonly themes = THEMES;
  protected readonly language = this.languageService.language;
  protected readonly theme = this.themeService.theme;

  protected selectLanguage(language: Language): void {
    this.languageService.setLanguage(language);
  }

  protected selectTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }
}

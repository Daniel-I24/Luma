import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LANGUAGES, LanguageService } from '@core/i18n/language.service';
import type { Language } from '@core/i18n/language.service';
import { THEMES, ThemeService } from '@core/theme/theme.service';
import type { Theme } from '@core/theme/theme.service';
import { LumaDisclosure } from '@design-system';

const SWATCH_CLASS: Record<Theme, string> = {
  indigo: 'bg-swatch-indigo',
  midnight: 'bg-swatch-midnight',
  pearl: 'bg-swatch-pearl',
  sunset: 'bg-swatch-sunset',
};

/**
 * AppearanceSettings — "Apariencia" group of the profile: collapsible
 * theme and language pickers (native radio groups).
 */
@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaDisclosure],
  templateUrl: './appearance-settings.html',
})
export class AppearanceSettings {
  private readonly languageService = inject(LanguageService);
  private readonly themeService = inject(ThemeService);

  protected readonly themes = THEMES;
  protected readonly languages = LANGUAGES;
  protected readonly swatchClass = SWATCH_CLASS;
  protected readonly theme = this.themeService.theme;
  protected readonly language = this.languageService.language;

  protected selectTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  protected selectLanguage(language: Language): void {
    this.languageService.setLanguage(language);
  }
}

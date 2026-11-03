import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ThemeService } from '@core/theme/theme.service';
import type { Theme } from '@core/theme/theme.service';
import { LumaButton, LumaBottomSheet, StatusBadge, LumaInput } from '@design-system';
import { PreviewCardsGrid } from './components/preview-cards-grid/preview-cards-grid';
import { PreviewChipsRow } from './components/preview-chips-row/preview-chips-row';

/** All available themes for the selector. */
interface ThemeOption {
  value: Theme;
  labelKey: string;
}

/**
 * DesignPreviewPage — temporary dev route (/design-preview).
 * Shows every design-system component in all its variants,
 * plus a live theme switcher.
 */
@Component({
  selector: 'app-design-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaButton,
    LumaBottomSheet,
    StatusBadge,
    LumaInput,
    PreviewChipsRow,
    PreviewCardsGrid,
  ],
  templateUrl: './design-preview.html',
  styleUrl: './design-preview.css',
})
export class DesignPreviewPage {
  protected readonly themeService = inject(ThemeService);

  protected readonly themes: ThemeOption[] = [
    { value: 'sky', labelKey: 'designPreview.themeSelector.sky' },
    { value: 'night', labelKey: 'designPreview.themeSelector.night' },
    { value: 'lacquer', labelKey: 'designPreview.themeSelector.lacquer' },
    { value: 'maize', labelKey: 'designPreview.themeSelector.maize' },
  ];

  protected readonly sheetOpen = signal(false);
  protected readonly inputValue = signal('');

  protected selectTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  protected openSheet(): void {
    this.sheetOpen.set(true);
  }

  protected closeSheet(): void {
    this.sheetOpen.set(false);
  }
}

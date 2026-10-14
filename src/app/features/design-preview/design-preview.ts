import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ThemeService } from '@core/theme/theme.service';
import type { Theme } from '@core/theme/theme.service';
import { LumaButton, LumaBottomSheet, StatusBadge, LumaInput, LumaChip } from '@design-system';
import { PreviewCardsGrid } from './components/preview-cards-grid/preview-cards-grid';

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
    LumaChip,
    PreviewCardsGrid,
  ],
  templateUrl: './design-preview.html',
  styleUrl: './design-preview.css',
})
export class DesignPreviewPage {
  protected readonly themeService = inject(ThemeService);

  protected readonly themes: ThemeOption[] = [
    { value: 'indigo', labelKey: 'designPreview.themeSelector.indigo' },
    { value: 'midnight', labelKey: 'designPreview.themeSelector.midnight' },
    { value: 'pearl', labelKey: 'designPreview.themeSelector.pearl' },
    { value: 'sunset', labelKey: 'designPreview.themeSelector.sunset' },
  ];

  protected readonly sheetOpen = signal(false);
  protected readonly inputValue = signal('');
  protected readonly chipSelected = signal(false);

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

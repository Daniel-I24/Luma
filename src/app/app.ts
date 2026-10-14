import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StatusBarThemeService } from '@core/native/status-bar-theme.service';
import { ThemeService } from '@core/theme/theme.service';
// Direct path, not the '@design-system' barrel: the barrel would pull every
// component into the initial bundle.
import { LumaToastHost } from '@design-system/toast/luma-toast-host';

/**
 * App root component.
 * Injecting ThemeService here ensures it is instantiated during bootstrap,
 * so its effect applies data-theme on <html> before the first render (no FOUC).
 */
@Component({
  imports: [RouterOutlet, LumaToastHost],
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet /><app-luma-toast-host />`,
})
export class App {
  // Eager injection — constructor + effect run at app startup.
  readonly themeService = inject(ThemeService);
  private readonly statusBarTheme = inject(StatusBarThemeService);
}

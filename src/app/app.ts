import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StatusBarThemeService } from '@core/native/status-bar-theme.service';
import { AppEntry } from '@core/startup/app-entry';
import { ThemeService } from '@core/theme/theme.service';
// Direct path, not the '@design-system' barrel: the barrel would pull every
// component into the initial bundle.
import { LumaToastHost } from '@design-system/toast/luma-toast-host';
import { ConnectionNotice } from '@shared/layout/connection-notice/connection-notice';
import { UpdateBanner } from '@shared/layout/update-banner/update-banner';
import { TutorialHost } from '@shared/tutorial/tutorial-host';

/**
 * App root component.
 * Injecting ThemeService here ensures it is instantiated during bootstrap,
 * so its effect applies data-theme on <html> before the first render (no FOUC).
 */
@Component({
  imports: [RouterOutlet, LumaToastHost, ConnectionNotice, UpdateBanner, TutorialHost],
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Guides load when the browser is idle, outside the initial bundle.
  template: `<app-update-banner /><app-connection-notice /><router-outlet /><app-luma-toast-host />
    @defer (on idle) {<app-tutorial-host />}`,
})
export class App {
  // Eager injection — constructor + effect run at app startup.
  public readonly themeService = inject(ThemeService);
  private readonly statusBarTheme = inject(StatusBarThemeService);

  constructor() {
    // Continues the native splash until the first screen is ready (index.html).
    inject(AppEntry).start();
  }
}

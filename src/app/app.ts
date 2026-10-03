import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '@core/theme/theme.service';

/**
 * App root component.
 * Injecting ThemeService here ensures it is instantiated during bootstrap,
 * so its effect applies data-theme on <html> before the first render (no FOUC).
 */
@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`,
})
export class App {
  // Eager injection — constructor + effect run at app startup.
  readonly themeService = inject(ThemeService);
}

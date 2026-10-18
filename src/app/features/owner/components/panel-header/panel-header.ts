import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIconButton } from '@design-system';

/** PanelHeader — page title of every Luma Negocios screen, with a back button below the tabs. */
@Component({
  selector: 'app-panel-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIconButton],
  templateUrl: './panel-header.html',
})
export class PanelHeader {
  private readonly router = inject(Router);

  /** Already translated title. */
  readonly heading = input.required<string>();
  readonly subtitle = input<string | undefined>(undefined);
  /** Screens under a tab go back to it; tab roots have no back button (null). */
  readonly backLink = input<readonly string[] | null>(null);

  protected back(): void {
    const link = this.backLink();
    if (link) void this.router.navigate([...link]);
  }
}

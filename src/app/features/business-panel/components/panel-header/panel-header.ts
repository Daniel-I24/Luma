import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIconButton } from '@design-system';

/** PanelHeader — back button and page title of every panel screen. */
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
  readonly backLink = input<readonly string[]>(['/profile']);

  protected back(): void {
    void this.router.navigate([...this.backLink()]);
  }
}

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
  template: `
    <header *transloco="let t" class="flex items-start gap-2">
      @if (backLink()) {
      <app-luma-icon-button
        icon="arrow-left"
        variant="ghost"
        [label]="t('businessPanel.back')"
        (clicked)="back()"
      />
      }
      <div class="flex min-w-0 flex-col gap-1 pt-1">
        <h1 class="m-0 text-h3 text-fg">{{ heading() }}</h1>
        @if (subtitle(); as text) {
        <p class="m-0 text-body-sm text-fg-muted">{{ text }}</p>
        }
      </div>
    </header>
  `,
})
export class PanelHeader {
  private readonly router = inject(Router);

  /** Already translated title. */
  public readonly heading = input.required<string>();
  public readonly subtitle = input<string | undefined>(undefined);
  /** Screens under a tab go back to it; tab roots have no back button (null). */
  public readonly backLink = input<readonly string[] | null>(null);

  protected back(): void {
    const link = this.backLink();
    if (link) void this.router.navigate([...link]);
  }
}

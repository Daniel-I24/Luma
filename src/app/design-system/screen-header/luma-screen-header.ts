import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BackNavigation } from '@core/navigation/back-navigation';
import { LumaIconButton } from '../icon-button/luma-icon-button';

/**
 * LumaScreenHeader — the one header of a screen: the back arrow as an icon,
 * the title (and an optional line under it), and the screen's actions as
 * icon buttons with an accessible label, projected on the right. The arrow
 * goes to `backLink` when given, otherwise to the parent screen
 * (BackNavigation), the same place the phone's back button goes.
 */
@Component({
  selector: 'app-luma-screen-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaIconButton, TranslocoPipe],
  template: `
    <header class="flex min-h-11 items-start gap-1">
      @if (back()) {
      <app-luma-icon-button icon="arrow-left" variant="ghost" [label]="backLabel() ?? ('common.back' | transloco)" (clicked)="goBack()" />
      }
      <div class="flex min-w-0 flex-1 flex-col gap-1 pt-1">
        <h1 class="m-0 text-h3 wrap-break-word text-fg">{{ heading() }}</h1>
        @if (subtitle(); as text) {
        <p class="m-0 text-body-sm text-fg-muted">{{ text }}</p>
        }
      </div>
      <div class="flex shrink-0 items-center gap-1"><ng-content /></div>
    </header>
  `,
})
export class LumaScreenHeader {
  private readonly router = inject(Router);
  private readonly navigation = inject(BackNavigation);

  /** Already translated title. */
  public readonly heading = input.required<string>();
  public readonly subtitle = input<string | undefined>(undefined);
  /** False on the first screen of a tab or section, which has nowhere to go back to. */
  public readonly back = input(true);
  public readonly backLabel = input<string | undefined>(undefined);
  /** Where the arrow leads when the screen knows it; otherwise its parent screen. */
  public readonly backLink = input<readonly string[] | null>(null);

  protected goBack(): void {
    const link = this.backLink();
    if (link) void this.router.navigate([...link]);
    else void this.navigation.up();
  }
}

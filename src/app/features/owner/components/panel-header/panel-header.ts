import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaScreenHeader } from '@design-system';

/** PanelHeader — page title of every Luma Negocios screen (LumaScreenHeader), with a back button below the tabs. */
@Component({
  selector: 'app-panel-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaScreenHeader],
  template: `
    <app-luma-screen-header
      *transloco="let t"
      [heading]="heading()"
      [subtitle]="subtitle()"
      [back]="backLink() !== null"
      [backLabel]="t('businessPanel.back')"
      [backLink]="backLink()"
    />
  `,
})
export class PanelHeader {
  /** Already translated title. */
  public readonly heading = input.required<string>();
  public readonly subtitle = input<string | undefined>(undefined);
  /** Screens under a tab go back to it; tab roots have no back button (null). */
  public readonly backLink = input<readonly string[] | null>(null);
}

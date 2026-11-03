import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIconButton } from '@design-system/icon-button/luma-icon-button';
import { GuidedTour } from './guided-tour.service';
import type { TourId } from './tour-registry';

/** TourHelpButton — the "?" of a screen: shows its guide again. */
@Component({
  selector: 'app-tour-help-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIconButton],
  template: `
    <app-luma-icon-button
      *transloco="let t"
      icon="help"
      variant="ghost"
      [label]="t('tours.replay')"
      (clicked)="tour.start(id())"
    />
  `,
})
export class TourHelpButton {
  protected readonly tour = inject(GuidedTour);
  public readonly id = input.required<TourId>();
}

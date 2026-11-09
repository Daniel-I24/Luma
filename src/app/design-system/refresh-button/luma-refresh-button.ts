import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LumaIconButton } from '../icon-button/luma-icon-button';

/**
 * LumaRefreshButton — reloads the data of a screen or retries a failed read: the 44 px reload
 * icon, which turns while `busy`. Actions that do something else keep their words.
 */
@Component({
  selector: 'app-luma-refresh-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LumaIconButton],
  template: `
    <app-luma-icon-button
      icon="refresh"
      variant="ghost"
      [label]="'common.reload' | transloco"
      [spinning]="busy()"
      [disabled]="busy()"
      (clicked)="clicked.emit()"
    />
  `,
  host: { class: 'inline-flex' },
})
export class LumaRefreshButton {
  /** True while the data is being read again. */
  public readonly busy = input(false);

  public readonly clicked = output<void>();
}

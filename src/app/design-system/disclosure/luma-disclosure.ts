import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { LumaIcon } from '../icon/luma-icon';
import type { IconName } from '../icon/luma-icons';

/**
 * LumaDisclosure — settings row that expands a panel below it. The header is
 * a real button with aria-expanded/aria-controls; texts arrive translated.
 */
@Component({
  selector: 'app-luma-disclosure',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaIcon],
  templateUrl: './luma-disclosure.html',
  host: { class: 'block' },
})
export class LumaDisclosure {
  readonly panelId = input.required<string>();
  readonly icon = input.required<IconName>();
  readonly heading = input.required<string>();
  /** Current value shown under the heading (e.g. the active theme). */
  readonly description = input<string | null>(null);

  readonly expanded = model(false);

  protected readonly buttonId = computed(() => `${this.panelId()}-button`);
}

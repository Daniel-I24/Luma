import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LUMA_ICONS } from './luma-icons';
import type { IconName } from './luma-icons';

export type IconSize = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<IconSize, string> = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
};

/**
 * LumaIcon — inline SVG icon from the Luma registry. Decorative by default
 * (aria-hidden); pass an already translated `label` when the icon alone
 * carries meaning.
 */
@Component({
  selector: 'app-luma-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './luma-icon.html',
  host: { class: 'inline-flex shrink-0' },
})
export class LumaIcon {
  readonly name = input.required<IconName>();
  readonly size = input<IconSize>('md');
  /** Fills the shape with the current color (e.g. a rated star). */
  readonly filled = input(false);
  readonly label = input<string | null>(null);

  protected readonly paths = computed(() => LUMA_ICONS[this.name()]);
  protected readonly sizeClass = computed(() => SIZE_CLASS[this.size()]);
}

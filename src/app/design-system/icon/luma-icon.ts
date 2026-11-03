import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LUMA_ICONS } from './luma-icons';
import type { IconName } from './luma-icons';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<IconSize, string> = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
  /** Hero visuals, e.g. a feed post without a photo. */
  xl: 'size-16',
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
  template: `
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
      [attr.class]="sizeClass()"
      fill="currentColor"
      [style.fill-opacity]="filled() ? 1 : 0"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label()"
      [attr.aria-hidden]="label() ? null : 'true'"
    >
      @for (d of paths(); track $index) {
      <path [attr.d]="d" />
      }
    </svg>
  `,
  host: { class: 'inline-flex shrink-0' },
})
export class LumaIcon {
  public readonly name = input.required<IconName>();
  public readonly size = input<IconSize>('md');
  /** Fills the shape with the current color (e.g. a rated star). */
  public readonly filled = input(false);
  public readonly label = input<string | null>(null);

  protected readonly paths = computed(() => LUMA_ICONS[this.name()]);
  protected readonly sizeClass = computed(() => SIZE_CLASS[this.size()]);
}

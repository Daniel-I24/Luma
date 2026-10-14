import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LumaIcon } from '../icon/luma-icon';
import type { IconName } from '../icon/luma-icons';

export type IconButtonVariant = 'surface' | 'ghost' | 'primary';

const VARIANT_CLASS: Record<IconButtonVariant, string> = {
  surface: 'bg-surface-elevated text-fg shadow-md hover:bg-canvas-subtle',
  ghost: 'border border-border bg-transparent text-fg-brand hover:bg-surface-selected',
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
};

/**
 * LumaIconButton — 44px square button with a single icon. The `label` is
 * required because the icon alone gives no accessible name.
 */
@Component({
  selector: 'app-luma-icon-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaIcon],
  templateUrl: './luma-icon-button.html',
  host: { class: 'inline-flex' },
})
export class LumaIconButton {
  readonly icon = input.required<IconName>();
  /** Already translated accessible name. */
  readonly label = input.required<string>();
  readonly variant = input<IconButtonVariant>('surface');
  readonly disabled = input(false);
  /** Toggle state (aria-pressed); undefined for plain buttons. */
  readonly pressed = input<boolean | undefined>(undefined);
  readonly filledIcon = input(false);

  readonly clicked = output<void>();

  protected readonly classes = computed(() =>
    [
      'inline-flex size-11 cursor-pointer items-center justify-center rounded-md border-0',
      'transition-transform duration-150 active:scale-95',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
      'disabled:cursor-not-allowed disabled:opacity-45',
      VARIANT_CLASS[this.variant()],
    ].join(' '),
  );
}

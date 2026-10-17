import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'accent' | 'danger' | 'danger-outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * LumaButton — base interactive button for the Luma design system.
 *
 * Variants: primary | secondary | ghost | accent | danger | danger-outline
 * (danger-outline: discreet destructive action, e.g. deleting the account)
 * Sizes:    sm | md | lg (all keep the 44px touch target)
 */
@Component({
  selector: 'app-luma-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './luma-button.html',
  styleUrl: './luma-button.css',
  host: { '[class.block]': 'fullWidth()', '[class.flex-1]': 'fullWidth()' },
})
export class LumaButton {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly fullWidth = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly ariaLabel = input<string | undefined>(undefined);
  /** id of the native button, e.g. to move the focus to it. */
  readonly buttonId = input<string | null>(null);
  /** id of an element that describes the button (aria-describedby). */
  readonly describedBy = input<string | null>(null);

  readonly clicked = output<void>();

  protected get hostClasses(): string {
    return [
      'luma-btn',
      `luma-btn--${this.variant()}`,
      `luma-btn--${this.size()}`,
      this.fullWidth() ? 'luma-btn--full' : '',
      this.disabled() ? 'luma-btn--disabled' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  protected handleClick(): void {
    if (!this.disabled()) {
      this.clicked.emit();
    }
  }
}

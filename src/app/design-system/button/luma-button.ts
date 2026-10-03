import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * LumaButton — base interactive button for the Luma design system.
 *
 * Variants: primary | secondary | ghost | danger
 * Sizes:    sm | md | lg
 */
@Component({
  selector: 'app-luma-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './luma-button.html',
  styleUrl: './luma-button.css',
})
export class LumaButton {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly disabled = input<boolean>(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly ariaLabel = input<string | undefined>(undefined);

  readonly clicked = output<void>();

  protected get hostClasses(): string {
    return [
      'luma-btn',
      `luma-btn--${this.variant()}`,
      `luma-btn--${this.size()}`,
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

import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

export type InputType = 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number';

/**
 * LumaInput — styled text input for the Luma design system.
 *
 * Uses two-way binding via model() for value.
 * Supports label, hint, error state, and leading/trailing icons via slots.
 */
@Component({
  selector: 'app-luma-input',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './luma-input.html',
  styleUrl: './luma-input.css',
})
export class LumaInput {
  readonly inputId = input<string>(`luma-input-${Math.random().toString(36).slice(2, 8)}`);
  readonly label = input<string | undefined>(undefined);
  readonly placeholder = input<string>('');
  readonly type = input<InputType>('text');
  readonly hint = input<string | undefined>(undefined);
  readonly errorMessage = input<string | undefined>(undefined);
  readonly disabled = input<boolean>(false);
  readonly required = input<boolean>(false);

  /** Two-way bindable value. */
  readonly value = model<string>('');

  protected get hasError(): boolean {
    return !!this.errorMessage();
  }

  protected get wrapperClasses(): string {
    return [
      'luma-input__wrapper',
      this.hasError ? 'luma-input__wrapper--error' : '',
      this.disabled() ? 'luma-input__wrapper--disabled' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }
}

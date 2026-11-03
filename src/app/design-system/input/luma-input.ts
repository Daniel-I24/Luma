import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { RADIX_36 } from '@core/config/units';

/** Six random characters after "0.". */
const ID_START = 2;
const ID_END = 8;

export type InputType =
  'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number' | 'time' | 'datetime-local';

/**
 * LumaInput — styled text input for the Luma design system.
 *
 * Uses two-way binding via model() for value.
 * Supports label, hint, error state, and leading/trailing icons via slots.
 * `blurred` lets forms show a field's error once the user leaves it;
 * `digitsOnly` keeps only digits (prices, codes) and `counter` shows the
 * characters used against maxLength. Text fields never drop keys.
 */
@Component({
  selector: 'app-luma-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './luma-input.html',
  styleUrl: './luma-input.css',
})
export class LumaInput {
  public readonly inputId = input<string>(`luma-input-${Math.random().toString(RADIX_36).slice(ID_START, ID_END)}`);
  public readonly label = input<string | undefined>(undefined);
  public readonly placeholder = input<string>('');
  public readonly type = input<InputType>('text');
  public readonly hint = input<string | undefined>(undefined);
  public readonly errorMessage = input<string | undefined>(undefined);
  public readonly disabled = input<boolean>(false);
  public readonly required = input<boolean>(false);
  /** Native maxlength; pair it with a counter in the hint. */
  public readonly maxLength = input<number | null>(null);
  /** Virtual keyboard hint, e.g. 'numeric' for codes. */
  public readonly inputMode = input<string | null>(null);
  /** e.g. 'one-time-code', 'email', 'new-password', 'current-password'. */
  public readonly autocomplete = input<string | null>(null);

  /** Numeric fields: anything that is not a digit is filtered out as it is typed. */
  public readonly digitsOnly = input(false);
  /** Shows "used / maxLength" under the field. */
  public readonly counter = input(false);

  /** Two-way bindable value. */
  public readonly value = model<string>('');
  /** The user left the field. */
  public readonly blurred = output<void>();

  protected readonly used = computed(() => Array.from(this.value()).length);

  protected onInput(field: HTMLInputElement): void {
    const typed = field.value;
    const value = this.digitsOnly() ? typed.replace(/\D/g, '') : typed;
    if (value !== typed) field.value = value;
    this.value.set(value);
  }

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

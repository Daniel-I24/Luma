import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { RADIX_36 } from '@core/config/units';

/** Six random characters after "0.". */
const ID_START = 2;
const ID_END = 8;

export interface SelectOption {
  readonly value: string;
  /** Already translated text. */
  readonly label: string;
}

/**
 * LumaSelect — native <select> with the same field styling as LumaInput
 * (shared stylesheet), label, hint and error wired with aria-describedby.
 */
@Component({
  selector: 'app-luma-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="luma-input">
      @if (label()) {
      <label class="luma-input__label" [for]="selectId()">
        {{ label() }} @if (required()) {
        <span class="luma-input__required" aria-hidden="true">*</span>
        }
      </label>
      }

      <div
        class="luma-input__wrapper"
        [class.luma-input__wrapper--error]="!!errorMessage()"
        [class.luma-input__wrapper--disabled]="disabled()"
      >
        <select
          class="luma-input__field luma-input__field--select"
          [id]="selectId()"
          [disabled]="disabled()"
          [required]="required()"
          [attr.aria-invalid]="errorMessage() ? 'true' : null"
          [attr.aria-describedby]="describedBy()"
          (change)="onChange($event)"
        >
          @if (placeholder() !== undefined) {
          <option value="" [selected]="value() === ''">{{ placeholder() }}</option>
          } @for (option of options(); track option.value) {
          <option [value]="option.value" [selected]="option.value === value()">{{ option.label }}</option>
          }
        </select>
      </div>

      @if (errorMessage()) {
      <span [id]="selectId() + '-error'" class="luma-input__error" role="alert">{{ errorMessage() }}</span>
      } @else if (hint()) {
      <span [id]="selectId() + '-hint'" class="luma-input__hint">{{ hint() }}</span>
      }
    </div>
  `,
  styleUrl: '../input/luma-input.css',
})
export class LumaSelect {
  public readonly selectId = input<string>(`luma-select-${Math.random().toString(RADIX_36).slice(ID_START, ID_END)}`);
  public readonly label = input<string | undefined>(undefined);
  public readonly options = input<readonly SelectOption[]>([]);
  /** Text of an empty first option; omitted when undefined. */
  public readonly placeholder = input<string | undefined>(undefined);
  public readonly hint = input<string | undefined>(undefined);
  public readonly errorMessage = input<string | undefined>(undefined);
  public readonly disabled = input<boolean>(false);
  public readonly required = input<boolean>(false);

  /** Two-way bindable value. */
  public readonly value = model<string>('');

  protected onChange(event: Event): void {
    this.value.set((event.target as HTMLSelectElement).value);
  }

  protected describedBy(): string | null {
    if (this.errorMessage()) return `${this.selectId()}-error`;
    return this.hint() ? `${this.selectId()}-hint` : null;
  }
}

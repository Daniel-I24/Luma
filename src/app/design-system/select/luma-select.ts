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
  templateUrl: './luma-select.html',
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

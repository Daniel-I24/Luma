import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

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
  readonly selectId = input<string>(`luma-select-${Math.random().toString(36).slice(2, 8)}`);
  readonly label = input<string | undefined>(undefined);
  readonly options = input<readonly SelectOption[]>([]);
  /** Text of an empty first option; omitted when undefined. */
  readonly placeholder = input<string | undefined>(undefined);
  readonly hint = input<string | undefined>(undefined);
  readonly errorMessage = input<string | undefined>(undefined);
  readonly disabled = input<boolean>(false);
  readonly required = input<boolean>(false);

  /** Two-way bindable value. */
  readonly value = model<string>('');

  protected onChange(event: Event): void {
    this.value.set((event.target as HTMLSelectElement).value);
  }

  protected describedBy(): string | null {
    if (this.errorMessage()) return `${this.selectId()}-error`;
    return this.hint() ? `${this.selectId()}-hint` : null;
  }
}

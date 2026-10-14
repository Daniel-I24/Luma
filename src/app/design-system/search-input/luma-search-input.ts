import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { LumaIcon } from '../icon/luma-icon';

/**
 * LumaSearchInput — rounded search field with icon and clear button.
 * Texts arrive already translated; `value` supports [(value)].
 */
@Component({
  selector: 'app-luma-search-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaIcon],
  templateUrl: './luma-search-input.html',
  host: { class: 'block' },
})
export class LumaSearchInput {
  readonly inputId = input('luma-search');
  /** Accessible label (visually hidden). */
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly clearLabel = input.required<string>();

  readonly value = model('');

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected clear(input: HTMLInputElement): void {
    this.value.set('');
    input.focus();
  }
}

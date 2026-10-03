import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
  output,
} from '@angular/core';

export type ChipVariant = 'default' | 'primary' | 'accent' | 'success' | 'warning' | 'danger';

/**
 * LumaChip — compact label/tag for filters, categories, and selections.
 *
 * Can be dismissible (shows a remove button) or selectable (toggle state).
 * `selected` uses model() to support [(selected)] two-way binding.
 */
@Component({
  selector: 'app-luma-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './luma-chip.html',
  styleUrl: './luma-chip.css',
})
export class LumaChip {
  readonly variant = input<ChipVariant>('default');
  /** Two-way bindable selected state. Supports [(selected)] syntax. */
  readonly selected = model<boolean>(false);
  readonly dismissible = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  readonly dismissed = output<void>();

  protected get hostClasses(): string {
    return [
      'luma-chip',
      `luma-chip--${this.variant()}`,
      this.selected() ? 'luma-chip--selected' : '',
      this.dismissible() ? 'luma-chip--dismissible' : '',
      this.disabled() ? 'luma-chip--disabled' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  protected toggle(): void {
    if (!this.disabled()) {
      this.selected.set(!this.selected());
    }
  }

  protected dismiss(event: Event): void {
    event.stopPropagation();
    if (!this.disabled()) {
      this.dismissed.emit();
    }
  }
}

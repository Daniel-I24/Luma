import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LumaIcon } from '../icon/luma-icon';
import type { IconName } from '../icon/luma-icons';

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
  imports: [TranslocoPipe, LumaIcon],
  template: `
    <span
      [class]="hostClasses"
      [attr.role]="dismissible() ? 'listitem' : 'button'"
      [attr.tabindex]="disabled() ? '-1' : '0'"
      [attr.aria-pressed]="!dismissible() ? selected() : null"
      [attr.aria-disabled]="disabled() ? 'true' : null"
      (click)="toggle()"
      (keydown.enter)="toggle()"
      (keydown.space)="$event.preventDefault(); toggle()"
    >
      @if (icon(); as name) {
      <app-luma-icon [name]="name" size="sm" />
      }
      <ng-content />

      @if (dismissible()) {
      <button
        class="luma-chip__dismiss"
        type="button"
        [attr.aria-label]="'common.remove' | transloco"
        [disabled]="disabled()"
        (click)="dismiss($event)"
      >
        <app-luma-icon name="close" size="sm" />
      </button>
      }
    </span>
  `,
  styleUrl: './luma-chip.css',
})
export class LumaChip {
  public readonly variant = input<ChipVariant>('default');
  /** Two-way bindable selected state. Supports [(selected)] syntax. */
  public readonly selected = model<boolean>(false);
  public readonly dismissible = input<boolean>(false);
  public readonly icon = input<IconName | null>(null);
  public readonly disabled = input<boolean>(false);
  /** False for single-choice groups: tapping the selected chip keeps it selected. */
  public readonly toggleable = input<boolean>(true);

  public readonly dismissed = output<void>();

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
    if (!this.toggleable() && this.selected()) return;
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

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * LumaSectionHeader — section title with an optional text action
 * (e.g. "Ver todos"). Texts arrive already translated.
 */
@Component({
  selector: 'app-luma-section-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="m-0 text-label-lg font-bold text-fg" [attr.id]="headingId()">{{ heading() }}</h2>
    @if (actionLabel(); as label) {
    <button
      type="button"
      class="min-h-11 cursor-pointer rounded-sm border-0 bg-transparent px-2 text-label text-fg-accent focus-visible:outline-2 focus-visible:outline-border-focus"
      (click)="action.emit()"
    >
      {{ label }}
    </button>
    }
  `,
  host: { class: 'flex items-center justify-between gap-2' },
})
export class LumaSectionHeader {
  public readonly heading = input.required<string>();
  public readonly headingId = input<string | null>(null);
  public readonly actionLabel = input<string | null>(null);

  public readonly action = output<void>();
}

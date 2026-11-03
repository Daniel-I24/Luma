import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * LumaSectionHeader — section title with an optional text action
 * (e.g. "Ver todos"). Texts arrive already translated.
 */
@Component({
  selector: 'app-luma-section-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './luma-section-header.html',
  host: { class: 'flex items-center justify-between gap-2' },
})
export class LumaSectionHeader {
  public readonly heading = input.required<string>();
  public readonly headingId = input<string | null>(null);
  public readonly actionLabel = input<string | null>(null);

  public readonly action = output<void>();
}

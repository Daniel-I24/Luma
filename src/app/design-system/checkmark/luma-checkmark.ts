import { ChangeDetectionStrategy, Component, input } from '@angular/core';

const DEFAULT_SIZE = 24;

/**
 * LumaCheckmark — success mark whose check draws itself once (motion-draw,
 * 340 ms; shown complete under reduced motion). Decorative: the text next to
 * it says what succeeded. Takes the text colour of its container.
 */
@Component({
  selector: 'app-luma-checkmark',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 24 24" [attr.width]="size()" [attr.height]="size()" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path class="motion-draw" pathLength="1" d="m7 12.5 3.2 3.2L17 9" />
    </svg>
  `,
})
export class LumaCheckmark {
  /** Size in px (16 inside a badge, 24 inline, 48 on a result screen). */
  public readonly size = input(DEFAULT_SIZE);
}

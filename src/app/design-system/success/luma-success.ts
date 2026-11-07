import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';

/** Long enough for the burst to end; the screen below stays usable meanwhile. */
const RAY_COUNT = 8;
const PLAY_MS = 1100;

/**
 * LumaSuccess — the moment an order is placed or a payment approved: a ring, a
 * small burst and the check, over the screen. Decorative: the page says what
 * happened in words, it never blocks a touch, and with reduced motion it is not
 * shown at all. Only transform and opacity.
 */
@Component({
  selector: 'app-luma-success',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    @if (play()) {
    <div class="success">
      <div class="success__mark">
        <span class="success__ring"></span>
        @for (ray of rays; track ray) {
        <span class="success__ray" [style.--ray]="ray"></span>
        }
        <svg class="success__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="m6 12.5 4 4L18 8.5" />
        </svg>
      </div>
    </div>
    }
  `,
  styleUrl: './luma-success.css',
})
export class LumaSuccess {
  /** True plays it once; `finished` tells when to set it back. */
  public readonly play = input<boolean>(false);
  public readonly finished = output<void>();

  protected readonly rays = Array.from({ length: RAY_COUNT }, (_, index) => index);

  constructor() {
    effect((onCleanup) => {
      if (!this.play()) return;
      const timer = setTimeout(() => this.finished.emit(), PLAY_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type SkeletonShape = 'text' | 'rect' | 'circle';

/**
 * LumaSkeleton — shimmering placeholder while content loads. Size it with
 * Tailwind spacing classes on the element (e.g. class="h-4 w-24"). Hidden
 * from screen readers: mark the loading region with aria-busy instead.
 */
@Component({
  selector: 'app-luma-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styles: `
    /* LumaSkeleton — subtle shimmer: a soft highlight slides across a canvas
       token with transform only. Motion is disabled globally under
       prefers-reduced-motion (styles/base.css). */
    :host {
      position: relative;
      display: block;
      overflow: hidden;
      background-color: var(--color-canvas-subtle);
    }

    :host::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, var(--color-canvas-muted), transparent);
      transform: translateX(-100%);
      animation: var(--animate-shimmer);
      will-change: transform;
    }
  `,
  host: {
    'aria-hidden': 'true',
    '[class.rounded-xs]': "shape() === 'text'",
    '[class.rounded-lg]': "shape() === 'rect'",
    '[class.rounded-full]': "shape() === 'circle'",
  },
})
export class LumaSkeleton {
  public readonly shape = input<SkeletonShape>('text');
}

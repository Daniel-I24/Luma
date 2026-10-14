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
  styleUrl: './luma-skeleton.css',
  host: {
    'aria-hidden': 'true',
    '[class.rounded-xs]': "shape() === 'text'",
    '[class.rounded-lg]': "shape() === 'rect'",
    '[class.rounded-full]': "shape() === 'circle'",
  },
})
export class LumaSkeleton {
  readonly shape = input<SkeletonShape>('text');
}

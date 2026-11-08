import { ChangeDetectionStrategy, Component, input, linkedSignal } from '@angular/core';
import { LumaIcon, type IconSize } from '../icon/luma-icon';
import type { IconName } from '../icon/luma-icons';

/**
 * LumaImage — content picture that fills its container: explicit width and
 * height (no layout shift), lazy loading, async decoding, alternative text,
 * and the given icon when there is no picture or it fails to load.
 * A plain image on purpose: NgOptimizedImage without an image CDN adds no
 * srcset, and with free-ratio photos under object-cover it warns on every
 * load (NG02952/NG02960).
 */
@Component({
  selector: 'app-luma-image',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaIcon],
  template: `
    @if (src() && !failed()) {
    <img
      class="size-full object-cover"
      decoding="async"
      [attr.loading]="eager() ? 'eager' : 'lazy'"
      [attr.fetchpriority]="eager() ? 'high' : null"
      [src]="src()"
      [alt]="alt()"
      [width]="width()"
      [height]="height()"
      (error)="failed.set(true)"
    />
    } @else {
    <span class="flex size-full items-center justify-center" [attr.role]="alt() ? 'img' : null" [attr.aria-label]="alt() || null">
      <app-luma-icon [name]="fallbackIcon()" [size]="iconSize()" />
    </span>
    }
  `,
  // `contents`: the image fills its parent, so size the PARENT (a span with
  // size-14…); classes on <app-luma-image> itself are ignored (round 8 bug:
  // the menu row image took the whole row).
  host: { class: 'contents' },
})
export class LumaImage {
  public readonly src = input<string | null | undefined>(null);
  /** Already translated; '' only for purely decorative pictures. */
  public readonly alt = input.required<string>();
  /** Intrinsic size in CSS pixels (reserves space before loading). */
  public readonly width = input.required<number>();
  public readonly height = input.required<number>();
  public readonly fallbackIcon = input<IconName>('store');
  public readonly iconSize = input<IconSize>('lg');
  /** Above-the-fold pictures load eagerly, with a high fetch priority. */
  public readonly eager = input(false);

  /** Reset whenever the source changes. */
  protected readonly failed = linkedSignal({ source: this.src, computation: () => false });
}

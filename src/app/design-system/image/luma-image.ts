import { ChangeDetectionStrategy, Component, input, linkedSignal } from '@angular/core';
import { LumaIcon, type IconSize } from '../icon/luma-icon';
import type { IconName } from '../icon/luma-icons';

/**
 * LumaImage — content picture that fills its container: explicit width and
 * height (no layout shift), lazy loading, async decoding, alternative text,
 * and the given icon when there is no picture or it fails to load.
 */
@Component({
  selector: 'app-luma-image',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaIcon],
  templateUrl: './luma-image.html',
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
  /** Above-the-fold pictures load eagerly. */
  public readonly eager = input(false);

  /** Reset whenever the source changes. */
  protected readonly failed = linkedSignal({ source: this.src, computation: () => false });
}

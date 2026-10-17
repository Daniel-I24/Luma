import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { LumaIcon } from '../icon/luma-icon';
import type { IconSize } from '../icon/luma-icon';
import type { IconName } from '../icon/luma-icons';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'circle' | 'square';

const ICON_SIZE: Record<AvatarSize, IconSize> = {
  xs: 'sm',
  sm: 'sm',
  md: 'md',
  lg: 'md',
  xl: 'lg',
};

/** Rendered size in CSS pixels (width/height attributes of the image). */
const SIZE_PX: Record<AvatarSize, number> = { xs: 24, sm: 32, md: 40, lg: 48, xl: 64 };

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: 'size-6 text-caption',
  sm: 'size-8 text-label',
  md: 'size-10 text-label-lg',
  lg: 'size-12 text-body',
  xl: 'size-16 text-h4',
};

/**
 * LumaAvatar — image of a person or business with an icon or initials fallback
 * (also used when the image fails to load).
 */
@Component({
  selector: 'app-luma-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaIcon],
  templateUrl: './luma-avatar.html',
  host: { class: 'inline-flex shrink-0' },
})
export class LumaAvatar {
  readonly name = input.required<string>();
  readonly src = input<string | null>(null);
  readonly size = input<AvatarSize>('md');
  readonly shape = input<AvatarShape>('circle');
  /** True when the name is already visible next to the avatar. */
  readonly decorative = input(false);
  /** Icon shown instead of the initials when there is no image (e.g. a category). */
  readonly fallbackIcon = input<IconName | null>(null);

  /** Reset whenever the source changes. */
  protected readonly failed = linkedSignal({ source: this.src, computation: () => false });
  protected readonly sizePx = computed(() => SIZE_PX[this.size()]);
  protected readonly iconSize = computed(() => ICON_SIZE[this.size()]);

  protected readonly initials = computed(() =>
    this.name()
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join(''),
  );

  protected readonly classes = computed(() =>
    [
      'inline-flex items-center justify-center overflow-hidden font-bold',
      'bg-canvas-subtle text-fg-brand',
      SIZE_CLASS[this.size()],
      this.shape() === 'circle' ? 'rounded-full' : 'rounded-md',
    ].join(' '),
  );
}

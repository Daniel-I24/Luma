import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'circle' | 'square';

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: 'size-6 text-caption',
  sm: 'size-8 text-label',
  md: 'size-10 text-label-lg',
  lg: 'size-12 text-body',
  xl: 'size-16 text-h4',
};

/**
 * LumaAvatar — image of a person or business with an initials fallback
 * (also used when the image fails to load).
 */
@Component({
  selector: 'app-luma-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  protected readonly failed = signal(false);

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

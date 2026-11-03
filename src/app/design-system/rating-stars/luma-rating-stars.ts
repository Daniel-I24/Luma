import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LumaIcon } from '../icon/luma-icon';

const STAR_COUNT = 5;

/**
 * LumaRatingStars — compact rating: star, score (0–5) and optional review
 * count. Screen readers get one full sentence instead of the fragments.
 */
@Component({
  selector: 'app-luma-rating-stars',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LumaIcon],
  template: `
    <span class="inline-flex items-center gap-1" aria-hidden="true">
      @if (variant() === 'stars') { @for (star of starSlots; track star) {
      <app-luma-icon
        name="star"
        size="sm"
        [class]="star <= roundedRating() ? 'text-rating' : 'text-fg-disabled'"
        [filled]="star <= roundedRating()"
      />
      } } @else {
      <app-luma-icon class="text-rating" name="star" size="sm" [filled]="true" />
      <span class="text-label-lg font-bold text-fg">{{ score() }}</span>
      @if (reviewCount() !== null) {
      <span class="text-caption text-fg-subtle"
        >{{ 'rating.reviews' | transloco: { count: reviewCount() } }}</span
      >
      } }
    </span>
    <span class="sr-only">
      @if (reviewCount() !== null) { {{ 'rating.labelWithReviews' | transloco: { rating: score(), count:
      reviewCount() } }} } @else { {{ 'rating.label' | transloco: { rating: score() } }} }
    </span>
  `,
  host: { class: 'inline-flex items-center' },
})
export class LumaRatingStars {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  public readonly rating = input.required<number>();
  public readonly reviewCount = input<number | null>(null);
  /** `compact`: one star and the score; `stars`: five stars (e.g. one review). */
  public readonly variant = input<'compact' | 'stars'>('compact');

  protected readonly starSlots = Array.from({ length: STAR_COUNT }, (_, i) => i + 1);
  protected readonly roundedRating = computed(() => Math.round(this.rating()));

  /** Score with one decimal, formatted for the active language. */
  protected readonly score = computed(() =>
    this.rating().toLocaleString(this.lang(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  );
}

import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaAvatar, LumaRatingStars } from '@design-system';
import type { ReviewWithAuthor } from '@shared/business/models/review.model';

/**
 * ReviewList — public reviews: author's display name (or "Usuario Luma"),
 * stars, date and comment. All user text goes through interpolation.
 */
@Component({
  selector: 'app-review-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaAvatar, LumaRatingStars],
  template: `
    <ul *transloco="let t" class="m-0 flex list-none flex-col gap-3 p-0">
      @for (review of reviews(); track review.id) {
      <li class="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface p-4">
        <div class="flex items-center gap-3">
          <app-luma-avatar
            size="sm"
            [name]="review.display_name ?? t('businessProfile.reviews.anonymous')"
            [fallbackIcon]="review.display_name ? null : 'user'"
            [decorative]="true"
          />
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-label-lg text-fg">
              {{ review.display_name ?? t('businessProfile.reviews.anonymous') }} @if (review.is_mine) {
              <span class="text-caption text-fg-accent"
                >· {{ t('businessProfile.reviews.yours') }}</span
              >
              }
            </span>
            <app-luma-rating-stars variant="stars" [rating]="review.rating" />
          </div>
          <time class="text-caption text-fg-subtle" [attr.datetime]="review.created_at"
            >{{ date(review) }}</time
          >
        </div>
        @if (review.comment; as comment) {
        <p class="m-0 text-body-sm whitespace-pre-line text-fg-muted">{{ comment }}</p>
        }
      </li>
      }
    </ul>
  `,
  host: { class: 'block' },
})
export class ReviewList {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  public readonly reviews = input.required<readonly ReviewWithAuthor[]>();

  protected date(review: ReviewWithAuthor): string {
    return new Intl.DateTimeFormat(this.lang(), { dateStyle: 'medium' }).format(
      new Date(review.created_at),
    );
  }
}

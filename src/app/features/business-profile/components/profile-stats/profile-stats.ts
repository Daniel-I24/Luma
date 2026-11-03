import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaIcon } from '@design-system';
import type { BusinessRating } from '@shared/business/models/review.model';

/**
 * ProfileStats — real rating and review count of a business (no invented
 * figures). Shows "Sin reseñas" when there are none and nothing when the
 * ratings could not be loaded.
 */
@Component({
  selector: 'app-profile-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIcon],
  template: `
    <ng-container *transloco="let t">
      @if (rating(); as r) {
      <dl class="m-0 flex gap-6 border-b border-border-subtle px-4 pb-3">
        <div class="flex flex-col items-center gap-1">
          <dt class="order-2 text-caption text-fg-subtle">{{ t('businessProfile.stats.rating') }}</dt>
          <dd class="m-0 flex items-center gap-1 text-h4 text-fg">
            <app-luma-icon class="text-rating" name="star" [filled]="true" />{{ score() }}
          </dd>
        </div>
        <div class="flex flex-col items-center gap-1">
          <dt class="order-2 text-caption text-fg-subtle">{{ t('businessProfile.stats.reviews') }}</dt>
          <dd class="m-0 text-h4 text-fg">{{ r.reviewCount }}</dd>
        </div>
      </dl>
      } @else if (ratingsLoaded()) {
      <p class="m-0 border-b border-border-subtle px-4 pb-3 text-body-sm text-fg-subtle">
        {{ t('rating.none') }}
      </p>
      }
    </ng-container>
  `,
  host: { class: 'block' },
})
export class ProfileStats {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  public readonly rating = input<BusinessRating | null>(null);
  public readonly ratingsLoaded = input(false);

  protected readonly score = computed(() =>
    this.rating()?.rating.toLocaleString(this.lang(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  );
}

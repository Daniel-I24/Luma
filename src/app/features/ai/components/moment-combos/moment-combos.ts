import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { Distance } from '@shared/geo/distance';
import type { DayMoment, MomentCombo } from '@shared/recommendations/recommendation.model';

/**
 * MomentCombos — "Combos para {momento}" under the moment chips of Luma IA:
 * 2 or 3 combos (dish, drink and an optional extra) of open businesses
 * nearby, with the total, the business and its distance. They only inform:
 * there is no "add" button. Without products for the moment, one plain line.
 */
@Component({
  selector: 'app-moment-combos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, CopCurrencyPipe],
  template: `
    <section *transloco="let t" class="flex flex-col gap-2" aria-labelledby="moment-combos-title">
      <h2 id="moment-combos-title" class="m-0 text-title text-fg">
        {{ t('ai.combos.title', { moment: t('ai.moments.' + moment()) }) }}
      </h2>
      @for (combo of combos(); track combo.business.id + combo.dish.id) {
        <article class="flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface p-3">
          <p class="m-0 text-body font-semibold text-fg">{{ name(combo) }}</p>
          <p class="m-0 text-body-sm text-fg-muted">
            {{ combo.business.name }}@if (combo.distanceKm !== null) { · {{ distance(combo.distanceKm) }} }
          </p>
          <p class="m-0 text-price text-fg">{{ combo.totalCop | cop }}</p>
        </article>
      } @empty {
        <p class="m-0 text-body-sm text-fg-muted">{{ t('ai.combos.none', { moment: t('ai.moments.' + moment()) }) }}</p>
      }
    </section>
  `,
})
export class MomentCombosSection {
  private readonly transloco = inject(TranslocoService);
  public readonly moment = input.required<DayMoment>();
  public readonly combos = input.required<readonly MomentCombo[]>();

  /** "Calentado + Tinto + Pan de yuca". */
  protected name(combo: MomentCombo): string {
    return [combo.dish, combo.drink, combo.extra].filter((item) => item !== null).map((item) => item.name).join(' + ');
  }

  protected distance(km: number): string {
    return Distance.formatDistance(km, this.transloco.getActiveLang());
  }
}

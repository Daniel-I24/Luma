import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import type { TodayStats } from '../../utils/today-stats.util';

/** TodayStatsView — today's orders by stage and the total sold; links to the orders tab. */
@Component({
  selector: 'app-today-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, CopCurrencyPipe],
  template: `
    <section *transloco="let t" class="flex flex-col gap-2" aria-labelledby="today-title">
      <h2 id="today-title" class="m-0 px-1 text-label tracking-wide text-fg-subtle uppercase">
        {{ t('owner.today.title') }}
      </h2>
      <a
        class="pressable grid grid-cols-3 gap-2 rounded-xl border border-border-subtle bg-surface p-4 text-fg no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        [routerLink]="ordersLink()"
        [attr.aria-label]="t('owner.today.openOrders')"
      >
        @for (figure of figures(); track figure.key) {
          <span class="flex flex-col items-center gap-1 text-center">
            <span class="text-h3 font-semibold">{{ figure.value }}</span>
            <span class="text-caption text-fg-muted">{{ t('owner.today.' + figure.key) }}</span>
          </span>
        }
      </a>
      <p class="m-0 flex items-center justify-between rounded-xl bg-surface-selected px-4 py-3">
        <span class="text-body-sm text-fg-muted">{{ t('owner.today.sold') }}</span>
        <span class="text-title text-fg">{{ stats().soldCop | cop }}</span>
      </p>
    </section>
  `,
})
export class TodayStatsView {
  readonly stats = input.required<TodayStats>();
  readonly ordersLink = input.required<readonly string[]>();

  protected readonly figures = computed(() => [
    { key: 'new', value: this.stats().newOrders },
    { key: 'preparing', value: this.stats().preparing },
    { key: 'ready', value: this.stats().ready },
  ]);
}

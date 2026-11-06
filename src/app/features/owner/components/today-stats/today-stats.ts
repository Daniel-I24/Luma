import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIcon } from '@design-system';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { type TodayStats, TodayStatsCalculator } from '../../utils/today-stats';

const TREND_ICON = { up: 'arrow-up', down: 'arrow-down', same: 'check' } as const;
const TREND_CLASS = { up: 'text-success-fg', down: 'text-danger-fg', same: 'text-fg-muted' } as const;

/**
 * TodayStatsView — the day in three cards: orders today and sales (each
 * with its trend against yesterday) and what is pending, then the orders
 * by stage; everything links to the orders tab.
 */
@Component({
  selector: 'app-today-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaIcon, CopCurrencyPipe],
  template: `
    <section *transloco="let t" class="flex flex-col gap-2" aria-labelledby="today-title">
      <h2 id="today-title" class="m-0 px-1 text-label tracking-wide text-fg-subtle uppercase">
        {{ t('owner.today.title') }}
      </h2>
      <div class="grid grid-cols-3 gap-2">
        <a [class]="card" [routerLink]="ordersLink()">
          <span class="text-caption text-fg-muted">{{ t('owner.today.orders') }}</span>
          <span class="text-h3 font-semibold">{{ stats().ordersToday }}</span>
          <span class="inline-flex items-center gap-1 text-caption" [class]="trendClass[ordersTrend()]">
            <app-luma-icon [name]="trendIcon[ordersTrend()]" size="sm" />
            {{ t('owner.today.vsYesterday', { value: stats().ordersYesterday }) }}
          </span>
        </a>
        <a [class]="card" [routerLink]="ordersLink()">
          <span class="text-caption text-fg-muted">{{ t('owner.today.sold') }}</span>
          <span class="truncate text-title font-semibold">{{ stats().soldCop | cop }}</span>
          <span class="inline-flex items-center gap-1 text-caption" [class]="trendClass[salesTrend()]">
            <app-luma-icon [name]="trendIcon[salesTrend()]" size="sm" />
            {{ t('owner.today.trend.' + salesTrend()) }}
          </span>
        </a>
        <a [class]="card" [routerLink]="ordersLink()">
          <span class="text-caption text-fg-muted">{{ t('owner.today.pending') }}</span>
          <span class="text-h3 font-semibold" [class.text-fg-brand]="pending() > 0">{{ pending() }}</span>
          <span class="text-caption text-fg-muted">{{ t('owner.today.pendingHint') }}</span>
        </a>
      </div>
      <a
        class="pressable grid grid-cols-3 gap-2 rounded-xl border border-border-subtle bg-surface p-3 text-fg no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        [routerLink]="ordersLink()"
      >
        <span class="sr-only">{{ t('owner.today.openOrders') }}</span>
        @for (figure of figures(); track figure.key) {
          <span class="flex flex-col items-center gap-1 text-center">
            <span class="text-title font-semibold">{{ figure.value }}</span>
            <span class="text-caption text-fg-muted">{{ t('owner.today.' + figure.key) }}</span>
          </span>
        }
      </a>
    </section>
  `,
})
export class TodayStatsView {
  public readonly stats = input.required<TodayStats>();
  public readonly ordersLink = input.required<readonly string[]>();

  protected readonly card =
    'pressable flex min-w-0 flex-col gap-1 rounded-xl border border-border-subtle bg-surface p-3 text-fg no-underline shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus';
  protected readonly trendIcon = TREND_ICON;
  protected readonly trendClass = TREND_CLASS;
  protected readonly ordersTrend = computed(() =>
    TodayStatsCalculator.trend(this.stats().ordersToday, this.stats().ordersYesterday),
  );
  protected readonly salesTrend = computed(() =>
    TodayStatsCalculator.trend(this.stats().soldCop, this.stats().soldYesterdayCop),
  );
  protected readonly pending = computed(() => this.stats().newOrders + this.stats().preparing + this.stats().ready);
  protected readonly figures = computed(() => [
    { key: 'new', value: this.stats().newOrders },
    { key: 'preparing', value: this.stats().preparing },
    { key: 'ready', value: this.stats().ready },
  ]);
}

import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaSkeleton } from '@design-system';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import type { SalesRange } from '../../services/sales-summary.repository';
import { type SalesBar, type SalesMeasure, SalesSummaryStore } from '../../state/sales-summary.store';
import { SALES_RANGES } from '../../state/sales-summary.store';

/**
 * SalesSummaryCard — one series of daily bars (orders or revenue) for the
 * last 7 or 30 days, with totals, the 5 most ordered dishes and the same
 * numbers as a table for screen readers. Tapping a bar shows its value.
 */
@Component({
  selector: 'app-sales-summary-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaSkeleton, CopCurrencyPipe],
  providers: [SalesSummaryStore],
  templateUrl: './sales-summary-card.html',
})
export class SalesSummaryCard {
  protected readonly sales = inject(SalesSummaryStore);
  public readonly businessId = input.required<string>();

  protected readonly ranges: readonly SalesRange[] = SALES_RANGES;
  protected readonly measures: readonly SalesMeasure[] = ['orders', 'revenue'];
  protected readonly selected = signal<SalesBar | null>(null);
  protected readonly empty = computed(() => this.sales.totals().orders === 0);

  constructor() {
    effect(() => {
      const id = this.businessId();
      untracked(() => void this.sales.load(id));
    });
  }

  protected setRange(range: SalesRange): void {
    this.selected.set(null);
    void this.sales.setRange(range);
  }

  protected setMeasure(measure: SalesMeasure): void {
    this.selected.set(null);
    this.sales.measure.set(measure);
  }

  /** "26/10" for the bar's accessible name and the caption. */
  protected shortDay(day: string): string {
    const [, month, date] = day.split('-');
    return `${date}/${month}`;
  }
}

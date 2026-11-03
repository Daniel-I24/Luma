import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaButton } from '@design-system';
import { BusinessPause } from '@shared/business/models/business-pause';
import type { Business } from '@shared/business/models/business.model';
import { DateFormat } from '@shared/format/date-format';
import { OrderPauseRepository } from '../../services/order-pause.repository';

/**
 * OrderPauseCard — "Pausar pedidos" on Resumen: stop new orders for 15, 30,
 * 60 or 120 minutes or until resuming (orders already placed go on). The
 * server refuses new orders meanwhile; customers see "Pedidos en pausa".
 */
@Component({
  selector: 'app-order-pause-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton],
  templateUrl: './order-pause-card.html',
})
export class OrderPauseCard {
  private readonly repo = inject(OrderPauseRepository);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  public readonly business = input.required<Business>();

  protected readonly options = BusinessPause.OPTIONS;
  protected readonly until = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly paused = computed(() => BusinessPause.isPaused(this.until()));
  protected readonly endsAt = computed(() => {
    const until = this.until();
    return until && !BusinessPause.isIndefinite(until) ? DateFormat.formatTime(until, this.lang()) : null;
  });

  constructor() {
    effect(() => this.until.set(this.business().orders_paused_until ?? null));
  }

  protected optionKey(minutes: number): string {
    return minutes === BusinessPause.UNTIL_RESUMED ? 'owner.pause.untilResumed' : 'owner.pause.minutes';
  }

  protected async set(minutes: number): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.errorKey.set(null);
    try {
      const result = await this.repo.set(this.business().id, minutes);
      if (result.errorKey) this.errorKey.set(result.errorKey);
      else this.until.set(result.data);
    } finally {
      this.busy.set(false);
    }
  }
}

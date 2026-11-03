import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DateFormat } from '@shared/format/date-format';
import { type TrustStatus, TrustStatusRepository } from '../../services/trust-status.repository';

const TONE: Readonly<Record<TrustStatus['tier'], string>> = {
  trusted: 'bg-success-bg text-success-fg',
  new: 'bg-info-bg text-info-fg',
  restricted: 'bg-danger-bg text-danger-fg',
};

/**
 * TrustStatusCard — "Tu estado" on the customer's Profile: the trust tier,
 * orders not picked up, when a restriction ends and how to improve. Shown
 * only when the server answers.
 */
@Component({
  selector: 'app-trust-status-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  templateUrl: './trust-status-card.html',
})
export class TrustStatusCard {
  private readonly repo = inject(TrustStatusRepository);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  protected readonly status = signal<TrustStatus | null>(null);
  protected readonly tone = computed(() => TONE[this.status()?.tier ?? 'new']);
  protected readonly until = computed(() => {
    const at = this.status()?.restrictedUntil;
    return at ? DateFormat.formatShortDate(at, this.lang()) : null;
  });

  constructor() {
    void this.repo.mine().then((status) => this.status.set(status));
  }
}

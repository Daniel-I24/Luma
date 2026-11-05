import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ErrorLog } from '@core/errors/error-log';
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
  template: `
    @if (status(); as s) {
    <section *transloco="let t" aria-labelledby="trust-heading">
      <h2 id="trust-heading" class="m-0 px-1 pt-4 pb-2 text-label tracking-wide text-fg-subtle uppercase">
        {{ t('trust.section') }}
      </h2>
      <div class="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-4">
        <p class="m-0 self-start rounded-full px-3 py-1 text-label" [class]="tone()">{{ t('trust.tier.' + s.tier) }}</p>
        <p class="m-0 text-body text-fg">{{ t('trust.explain.' + s.tier) }}</p>
        @if (s.strikes > 0) {
        <p class="m-0 text-body-sm text-fg-muted">{{ t('trust.strikes', { count: s.strikes }) }}</p>
        } @if (until(); as date) {
        <p class="m-0 text-body-sm text-fg-muted">{{ t('trust.until', { date }) }}</p>
        } @if (s.tier === 'new' && s.pickedUpNeeded > 0) {
        <p class="m-0 text-body-sm text-fg-muted">{{ t('trust.improve', { count: s.pickedUpNeeded }) }}</p>
        }
      </div>
    </section>
    }
  `,
})
export class TrustStatusCard {
  private readonly repo = inject(TrustStatusRepository);
  private readonly log = inject(ErrorLog);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  protected readonly status = signal<TrustStatus | null>(null);
  protected readonly tone = computed(() => TONE[this.status()?.tier ?? 'new']);
  protected readonly until = computed(() => {
    const at = this.status()?.restrictedUntil;
    return at ? DateFormat.formatShortDate(at, this.lang()) : null;
  });

  constructor() {
    this.repo
      .mine()
      .then((status) => this.status.set(status))
      .catch((error: unknown) => this.log.record(error, 'profile'));
  }
}

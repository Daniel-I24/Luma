import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaIcon } from '@design-system';
import { type TrustSummary, TrustSummaryRepository } from '@shared/business/data/trust-summary.repository';
import { DateFormat } from '@shared/format/date-format';

/**
 * TrustCard — the public trust card of a business: verified by Luma since,
 * verified contacts, completed orders as a range and time on Luma. Hidden
 * while it loads or when it cannot be read (it is a nicety, not a blocker).
 */
@Component({
  selector: 'app-trust-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIcon],
  template: `
    @if (summary(); as s) {
      <section
        *transloco="let t"
        class="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-4"
        aria-labelledby="trust-title"
      >
        <h3 id="trust-title" class="m-0 flex items-center gap-2 text-title text-fg">
          <app-luma-icon class="text-fg-brand" name="check" /> {{ t('businessProfile.trust.title') }}
        </h3>
        <ul class="m-0 flex list-none flex-col gap-1 p-0 text-body-sm text-fg-muted">
          @if (s.verified_since) {
            <li>{{ t('businessProfile.trust.verifiedSince', { date: date(s.verified_since) }) }}</li>
          }
          <li>
            {{ t('businessProfile.trust.contacts') }}
            @for (kind of s.verified_contacts; track kind; let last = $last) {
              {{ t('contactVerification.kind.' + kind) }}{{ last ? '' : ', ' }}
            } @empty {
              {{ t('businessProfile.trust.noContacts') }}
            }
          </li>
          <li>{{ t('businessProfile.trust.orders.' + s.completed_orders) }}</li>
          <li>{{ t('businessProfile.trust.months', { count: s.months_on_luma }) }}</li>
        </ul>
      </section>
    }
  `,
})
export class TrustCard {
  private readonly repo = inject(TrustSummaryRepository);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  public readonly businessId = input.required<string>();
  protected readonly summary = signal<TrustSummary | null>(null);

  constructor() {
    effect(() => {
      const id = this.businessId();
      untracked(() => void this.load(id));
    });
  }

  protected date(iso: string): string {
    return DateFormat.formatShortDate(iso, this.lang());
  }

  private async load(id: string): Promise<void> {
    const result = await this.repo.get(id);
    this.summary.set(result.data);
  }
}

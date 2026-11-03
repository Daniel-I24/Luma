import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { AdminOperationsRepository, type ReviewFlags } from '../../services/admin-operations.repository';

/** Signals that ask for a closer look, in display order. */
const SIGNALS = ['duplicate_tax_id', 'duplicate_phone', 'near_duplicate_location', 'similar_name'] as const;
/** An account younger than this is worth a second look. */
const NEW_ACCOUNT_DAYS = 7;

/** ReviewFlags — warning signs of a business under review (business_review_flags). */
@Component({
  selector: 'app-review-flags',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  template: `
    <section *transloco="let t" class="flex flex-col gap-2" aria-labelledby="review-flags">
      <h2 id="review-flags" class="m-0 text-label-lg text-fg">{{ t('admin.flags.title') }}</h2>
      @if (flags(); as f) {
        <ul class="m-0 flex list-none flex-col gap-1 p-0">
          @for (raised of raisedSignals(); track raised) {
            <li class="rounded-md bg-warning-bg p-2 text-body-sm text-warning-fg">{{ t('admin.flags.' + raised) }}</li>
          } @empty {
            <li class="text-body-sm text-fg-muted">{{ t('admin.flags.none') }}</li>
          }
        </ul>
        <p class="m-0 text-body-sm" [class.text-warning-fg]="f.owner_account_age_days < newAccountDays" [class.text-fg-muted]="f.owner_account_age_days >= newAccountDays">
          {{ t('admin.flags.account', { days: f.owner_account_age_days, count: f.owner_business_count }) }}
        </p>
      } @else if (errorKey(); as key) {
        <p class="m-0 text-body-sm text-danger-fg" role="alert">{{ t(key) }}</p>
      }
    </section>
  `,
})
export class ReviewFlagsView {
  private readonly repo = inject(AdminOperationsRepository);
  public readonly businessId = input.required<string>();
  protected readonly flags = signal<ReviewFlags | null>(null);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly newAccountDays = NEW_ACCOUNT_DAYS;
  protected readonly raisedSignals = computed(() => SIGNALS.filter((name) => this.flags()?.[name]));

  public constructor() {
    effect(() => {
      const id = this.businessId();
      untracked(() => void this.repo.reviewFlags(id).then((result) => {
        this.flags.set(result.data);
        this.errorKey.set(result.errorKey);
      }));
    });
  }
}

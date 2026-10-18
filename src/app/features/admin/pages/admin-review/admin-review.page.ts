import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaEmptyState, LumaIconButton, LumaSkeleton } from '@design-system';
import { Nit } from '@shared/business/domain/nit';
import type { ReviewDecision, VerificationDoc } from '@shared/business/verification/verification.model';
import { LocationPreview } from '../../components/location-preview/location-preview';
import { ReviewDecisionSheet } from '../../components/review-decision/review-decision';
import { AdminReviewStore } from '../../state/admin-review.store';

/** Public business registry, to check the legal data by hand. */
export const RUES_URL = 'https://www.rues.org.co/';

/** AdminReviewPage — /admin/businesses/:id: review one business and decide. */
@Component({
  selector: 'app-admin-review-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaButton,
    LumaEmptyState,
    LumaIconButton,
    LumaSkeleton,
    LocationPreview,
    ReviewDecisionSheet,
  ],
  providers: [AdminReviewStore],
  templateUrl: './admin-review.page.html',
  host: { class: 'block' },
})
export class AdminReviewPage {
  protected readonly store = inject(AdminReviewStore);
  private readonly router = inject(Router);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly ruesUrl = RUES_URL;
  protected readonly decision = signal<ReviewDecision | null>(null);
  /** Display form of the NIT; the raw value if it no longer parses. */
  protected readonly nit = computed(() => {
    const legal = this.store.legal();
    return legal ? (Nit.parse(legal.tax_id)?.display ?? legal.tax_id) : null;
  });
  /** Actions that make sense from the current status (review_business). */
  protected readonly actions = computed<ReviewDecision[]>(() => {
    switch (this.store.business()?.verification_status) {
      case 'pending':
        return ['approved', 'rejected'];
      case 'approved':
        return ['suspended'];
      default:
        return [];
    }
  });

  constructor() {
    void this.store.load(this.id);
  }

  protected reload(): void {
    void this.store.load(this.id);
  }

  protected async openDoc(doc: VerificationDoc): Promise<void> {
    const url = await this.store.signedUrl(doc);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected async decide(event: { decision: ReviewDecision; note: string | null }): Promise<void> {
    if (await this.store.decide(event.decision, event.note)) this.decision.set(null);
  }

  protected back(): void {
    void this.router.navigate(['/admin']);
  }
}

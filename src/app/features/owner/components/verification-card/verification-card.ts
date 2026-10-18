import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { type IconName, LumaButton, LumaIcon } from '@design-system';
import { ownerPaths } from '@shared/account/owner-paths';
import type { Business, VerificationStatus } from '@shared/business/models/business.model';
import type { ReviewRequirement } from '@shared/business/verification/verification.model';
import { REQUIREMENT_STEP } from '../../utils/review-checklist.util';

const STATUS_LOOK: Readonly<Record<VerificationStatus, { icon: IconName; tone: string }>> = {
  draft: { icon: 'edit', tone: 'bg-canvas-muted text-fg-muted' },
  pending: { icon: 'clock', tone: 'bg-info-bg text-info-fg' },
  approved: { icon: 'check', tone: 'bg-success-bg text-success-fg' },
  rejected: { icon: 'alert', tone: 'bg-warning-bg text-warning-fg' },
  suspended: { icon: 'alert', tone: 'bg-danger-bg text-danger-fg' },
};

/**
 * VerificationCard — review state of the business: draft (what is missing,
 * each linked to its step), pending, verified, changes requested (with the
 * team's note) and suspended.
 */
@Component({
  selector: 'app-verification-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaButton, LumaIcon],
  templateUrl: './verification-card.html',
})
export class VerificationCard {
  readonly business =
    input.required<Pick<Business, 'id' | 'verification_status' | 'verification_note'>>();
  readonly missing = input.required<readonly ReviewRequirement[]>();
  readonly busy = input(false);
  readonly errorKey = input<string | null>(null);
  readonly submitted = output<void>();

  protected readonly status = computed(() => this.business().verification_status);
  protected readonly look = computed(() => STATUS_LOOK[this.status()]);
  protected readonly canSubmit = computed(
    () =>
      (this.status() === 'draft' || this.status() === 'rejected') && this.missing().length === 0,
  );

  protected stepLink(requirement: ReviewRequirement): string[] {
    const step = REQUIREMENT_STEP[requirement];
    const id = this.business().id;
    return step.kind === 'section'
      ? ownerPaths.section(id, step.section)
      : ownerPaths.screen(id, step.screen);
  }

  protected verificationLink(): string[] {
    return ownerPaths.screen(this.business().id, 'verification');
  }
}

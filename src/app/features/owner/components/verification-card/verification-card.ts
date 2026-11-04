import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { type IconName, LumaButton, LumaIcon, LumaNotice } from '@design-system';
import { ownerPaths } from '@shared/account/account-paths';
import type { Business, VerificationStatus } from '@shared/business/models/business.model';
import type { ReviewRequirement } from '@shared/business/verification/verification.model';
import { REQUIREMENT_STEP } from '../../utils/review-checklist';
import { type VerificationStep, VerificationSteps } from './verification-steps';

const STATUS_LOOK: Readonly<Record<VerificationStatus, { icon: IconName; tone: string }>> = {
  draft: { icon: 'edit', tone: 'bg-canvas-muted text-fg-muted' },
  pending: { icon: 'clock', tone: 'bg-info-bg text-info-fg' },
  approved: { icon: 'check', tone: 'bg-success-bg text-success-fg' },
  rejected: { icon: 'alert', tone: 'bg-warning-bg text-warning-fg' },
  suspended: { icon: 'alert', tone: 'bg-danger-bg text-danger-fg' },
};

/**
 * VerificationCard — "Verifica tu negocio, paso N de 3": a progress bar and
 * three tappable steps (data, hours and menu, legal data and documents),
 * each with why it matters and "Completar" to its exact screen; the privacy
 * note and the time it takes. Then pending (what happens now and how long),
 * changes requested (the team's note and "Corregir"), verified and
 * suspended. A disabled "Enviar a revisión" says which steps are missing.
 */
@Component({
  selector: 'app-verification-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaNotice, TranslocoModule, RouterLink, LumaButton, LumaIcon],
  templateUrl: './verification-card.html',
})
export class VerificationCard {
  public readonly business =
    input.required<Pick<Business, 'id' | 'verification_status' | 'verification_note'>>();
  public readonly missing = input.required<readonly ReviewRequirement[]>();
  public readonly busy = input(false);
  public readonly errorKey = input<string | null>(null);
  public readonly submitted = output<void>();

  private readonly transloco = inject(TranslocoService);
  protected readonly status = computed(() => this.business().verification_status);
  /** Draft or changes requested: the owner still completes steps. */
  protected readonly editable = computed(() => this.status() === 'draft' || this.status() === 'rejected');
  protected readonly steps = computed(() => VerificationSteps.of(this.missing()));
  protected readonly current = computed(() => VerificationSteps.current(this.steps()));
  protected readonly doneCount = computed(() => this.steps().filter((step) => step.done).length);
  /** The titles of the steps still missing, for the reason under a disabled "Enviar". */
  protected readonly blockedSteps = computed(() =>
    this.steps()
      .filter((step) => !step.done)
      .map((step) => this.transloco.translate(`owner.verification.steps.${step.id}.title`))
      .join(', '),
  );
  protected readonly look = computed(() => STATUS_LOOK[this.status()]);
  protected readonly canSubmit = computed(
    () =>
      (this.status() === 'draft' || this.status() === 'rejected') && this.missing().length === 0,
  );

  /** The screen of the first thing the step misses (its first screen once done). */
  protected stepLink(step: VerificationStep): string[] {
    const requirement = step.missing[0] ?? step.requirements[0];
    // A step always has requirements; without one, the verification screen.
    return requirement ? this.requirementLink(requirement) : ownerPaths.screen(this.business().id, 'verification');
  }

  private requirementLink(requirement: ReviewRequirement): string[] {
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

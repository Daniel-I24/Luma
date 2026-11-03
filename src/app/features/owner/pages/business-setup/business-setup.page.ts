import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, ToastService } from '@design-system';
import { ownerPaths } from '@shared/account/owner-paths';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { PanelStateView } from '../../components/panel-state/panel-state';
import { PanelBusinessStore } from '../../state/panel-business.store';
import { PublishStore } from '../../state/publish.store';
import { VerificationStore } from '../../state/verification.store';
import { missingForReview } from '../../utils/review-checklist.util';
import { routeBusinessId } from '../../utils/route-business-id';
import { SetupSteps } from '../../utils/setup-steps';

/** Query parameter the step screens read to offer "Volver al asistente". */
export const SETUP_QUERY = { setup: '1' } as const;

/**
 * BusinessSetupPage — /owner/:id/setup: the wizard of a new business with
 * its progress (basics, location, hours, contact, legal data and documents,
 * menu) and the final review before "Enviar a revisión". Each step opens its
 * screen; the draft is the business itself, so it resumes on its own.
 */
@Component({
  selector: 'app-business-setup-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaButton, PanelHeader, PanelStateView],
  providers: [PanelBusinessStore, PublishStore, VerificationStore],
  templateUrl: './business-setup.page.html',
  host: { class: 'block' },
})
export class BusinessSetupPage {
  protected readonly panel = inject(PanelBusinessStore);
  protected readonly publish = inject(PublishStore);
  protected readonly verification = inject(VerificationStore);
  private readonly toast = inject(ToastService);
  protected readonly id = routeBusinessId();
  protected readonly steps = SetupSteps.ALL;
  protected readonly setupQuery = SETUP_QUERY;

  protected readonly missing = computed(() => {
    const business = this.panel.business();
    if (!business) return new Set<never>();
    return new Set(missingForReview({
      business, hours: this.publish.hours(), items: this.publish.items(),
      legal: this.verification.legal(), docs: this.verification.docs(),
    }));
  });
  protected readonly current = computed(() => SetupSteps.current(this.missing()));
  protected readonly percent = computed(() => Math.round(SetupSteps.progress(this.missing()) * 100));
  protected readonly summaryLink = computed(() => ownerPaths.section(this.id(), 'summary'));

  public constructor() {
    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.load(id));
    });
  }

  protected async load(id = this.id()): Promise<void> {
    await Promise.all([this.panel.load(id), this.publish.load(id), this.verification.load(id)]);
  }

  protected status(index: number): string {
    return SetupSteps.status(this.steps[index], this.missing());
  }

  protected async submit(): Promise<void> {
    if (await this.verification.submit()) this.toast.show({ messageKey: 'owner.verification.submitted', tone: 'success' });
  }
}

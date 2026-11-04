import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaBottomSheet, LumaButton, LumaNotice, ToastService } from '@design-system';
import { ownerPaths } from '@shared/account/account-paths';
import type { HasUnsavedChanges } from '@shared/forms/unsaved-changes.guard';
import { DocList } from '../../components/doc-list/doc-list';
import { LegalForm } from '../../components/legal-form/legal-form';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { PanelStateView } from '../../components/panel-state/panel-state';
import { PanelBusinessStore } from '../../state/panel-business.store';
import { VerificationStore } from '../../state/verification.store';
import { RouteBusinessId } from '../../utils/route-business-id';
import { SetupReturn } from '../../components/setup-return/setup-return';

/**
 * BusinessVerificationPage — /owner/:id/business/verification: legal data
 * and documents for the review; read-only while pending, verified or
 * suspended (the database enforces it too). An approved business may ask
 * to correct its legal data: it is hidden until a new review.
 */
@Component({
  selector: 'app-business-verification-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaNotice, SetupReturn, TranslocoModule, DocList, LegalForm, PanelHeader, PanelStateView, LumaBottomSheet, LumaButton],
  providers: [PanelBusinessStore, VerificationStore],
  template: `
    <div *transloco="let t" class="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-4 pb-6">
      <app-panel-state [state]="panel.state()" (retry)="load()">
        <app-panel-header [heading]="t('owner.verificationPage.title')" [backLink]="backLink()" />
      <app-setup-return />
        @if (panel.business()?.verification_status === 'approved') {
          <div class="flex flex-col gap-3 rounded-md bg-info-bg p-3 text-info-fg" role="status">
            <p class="m-0 text-body-sm">{{ t('owner.verificationPage.approvedNotice') }}</p>
            <app-luma-button variant="secondary" [fullWidth]="true" (clicked)="confirming.set(true)">
              {{ t('owner.verificationPage.requestCorrection') }}
            </app-luma-button>
          </div>
        } @else if (!verification.editable()) {
          <app-luma-notice>
            {{ t('owner.verificationPage.locked') }}
          </app-luma-notice>
        }
        @if (verification.errorKey(); as key) {
          <app-luma-notice tone="danger">
            {{ t(key) }}
          </app-luma-notice>
        }
        <app-legal-form />
        <app-doc-list />
      </app-panel-state>
      <app-luma-bottom-sheet
        [open]="confirming()"
        [title]="t('owner.verificationPage.correctionTitle')"
        (closed)="confirming.set(false)"
      >
        <app-luma-notice tone="warning" class="mb-4">
          {{ t('owner.verificationPage.correctionWarning') }}
        </app-luma-notice>
        <div class="flex flex-col gap-3">
          <app-luma-button variant="danger" [fullWidth]="true" [disabled]="verification.busy()" (clicked)="requestCorrection()">
            {{ t('owner.verificationPage.correctionConfirm') }}
          </app-luma-button>
          <app-luma-button variant="ghost" [fullWidth]="true" (clicked)="confirming.set(false)">
            {{ t('owner.verificationPage.correctionCancel') }}
          </app-luma-button>
        </div>
      </app-luma-bottom-sheet>
    </div>
  `,
  host: { class: 'block' },
})
export class BusinessVerificationPage implements HasUnsavedChanges {
  protected readonly panel = inject(PanelBusinessStore);
  protected readonly verification = inject(VerificationStore);
  protected readonly id = RouteBusinessId.routeBusinessId((id) => this.load(id));
  protected readonly backLink = computed(() => ownerPaths.section(this.id(), 'business'));
  private readonly legalForm = viewChild(LegalForm);
  private readonly toast = inject(ToastService);
  protected readonly confirming = signal(false);

  protected async load(id = this.id()): Promise<void> {
    await Promise.all([this.panel.load(id), this.verification.load(id)]);
  }

  /** Confirmed in the sheet: hidden until a new review, legal data unlocked. */
  protected async requestCorrection(): Promise<void> {
    if (!(await this.verification.requestLegalCorrection())) return;
    this.confirming.set(false);
    this.toast.show({ messageKey: 'owner.verificationPage.correctionDone', tone: 'success' });
  }

  /** For the leave warning (unsavedChangesGuard). */
  public hasUnsavedChanges(): boolean {
    return this.legalForm()?.hasChanges() ?? false;
  }
}

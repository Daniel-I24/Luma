import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ownerPaths } from '@shared/account/owner-paths';
import { DocList } from '../../components/doc-list/doc-list';
import { LegalForm } from '../../components/legal-form/legal-form';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { PanelStateView } from '../../components/panel-state/panel-state';
import { PanelBusinessStore } from '../../state/panel-business.store';
import { VerificationStore } from '../../state/verification.store';
import { routeBusinessId } from '../../utils/route-business-id';

/**
 * BusinessVerificationPage — /owner/:id/business/verification: legal data
 * and documents for the review; read-only while pending, verified or
 * suspended (the database enforces it too).
 */
@Component({
  selector: 'app-business-verification-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, DocList, LegalForm, PanelHeader, PanelStateView],
  providers: [PanelBusinessStore, VerificationStore],
  template: `
    <div *transloco="let t" class="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-4 pb-6">
      <app-panel-state [state]="panel.state()" (retry)="load()">
        <app-panel-header [heading]="t('owner.verificationPage.title')" [backLink]="backLink()" />
        @if (!verification.editable()) {
          <p class="m-0 rounded-md bg-info-bg p-3 text-body-sm text-info-fg" role="status">
            {{ t('owner.verificationPage.locked') }}
          </p>
        }
        @if (verification.errorKey(); as key) {
          <p class="m-0 rounded-md bg-danger-bg p-3 text-body-sm text-danger-fg" role="alert">
            {{ t(key) }}
          </p>
        }
        <app-legal-form />
        <app-doc-list />
      </app-panel-state>
    </div>
  `,
  host: { class: 'block' },
})
export class BusinessVerificationPage {
  protected readonly panel = inject(PanelBusinessStore);
  protected readonly verification = inject(VerificationStore);
  protected readonly id = routeBusinessId();
  protected readonly backLink = computed(() => ownerPaths.section(this.id(), 'business'));

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.load(id));
    });
  }

  protected async load(id = this.id()): Promise<void> {
    await Promise.all([this.panel.load(id), this.verification.load(id)]);
  }
}

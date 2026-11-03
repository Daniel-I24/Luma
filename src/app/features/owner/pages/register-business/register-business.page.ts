import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, ToastService } from '@design-system';
import { ownerPaths } from '@shared/account/account-paths';
import { newBusinessSchema } from '@shared/business/data/business-write.schemas';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { DraftNotice } from '@shared/forms/draft-notice/draft-notice';
import { FormDraftStore } from '@shared/forms/form-draft.store';
import { type FieldErrors, FormErrors } from '@shared/forms/form-errors';
import type { HasUnsavedChanges } from '@shared/forms/unsaved-changes.guard';
import { BusinessBasicsFields } from '../../components/business-basics-fields/business-basics-fields';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { OwnerContextStore } from '../../state/owner-context.store';
import { EMPTY_DRAFT, BusinessDrafts } from '../../utils/business-draft';

const ID_PREFIX = 'register';

/** RegisterBusinessPage — /owner/new: creates an unpublished draft business (at most 3). */
@Component({
  selector: 'app-register-business-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, BusinessBasicsFields, PanelHeader, DraftNotice],
  template: `
    <form
      *transloco="let t"
      class="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-[calc(env(safe-area-inset-top)+var(--spacing-6))] pb-6"
      novalidate
      (submit)="submit($event)"
    >
      <app-panel-header
        [heading]="t('businessPanel.register.title')"
        [subtitle]="t('businessPanel.register.subtitle')"
        [backLink]="backLink()"
      />
      <app-draft-notice [draft]="autosave" />

      <app-business-basics-fields [idPrefix]="idPrefix" [(errors)]="errors" [(draft)]="draft" />

      @if (errorKey(); as key) {
      <p class="m-0 rounded-md bg-danger-bg p-3 text-body-sm text-danger-fg" role="alert">
        {{ t(key) }}
      </p>
      }
      <app-luma-button type="submit" size="lg" [fullWidth]="true" [disabled]="saving()"
        >{{ t(saving() ? 'businessPanel.form.saving' : 'businessPanel.register.submit')
        }}</app-luma-button
      >
    </form>
  `,
  host: { class: 'block' },
})
export class RegisterBusinessPage implements HasUnsavedChanges {
  private readonly repo = inject(OwnedBusinessRepository);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly context = inject(OwnerContextStore);

  /** Back to Luma Negocios when there is a business to go back to. */
  protected readonly backLink = computed(() =>
    this.context.businesses()?.length ? ownerPaths.home() : null,
  );

  protected readonly idPrefix = ID_PREFIX;
  protected readonly draft = signal(EMPTY_DRAFT);
  protected readonly errors = signal<FieldErrors>({});
  protected readonly errorKey = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly autosave = inject(FormDraftStore).attach(this.draft);

  constructor() {
    this.autosave.load('register-business', EMPTY_DRAFT);
  }

  /** For the leave warning (unsavedChangesGuard). */
  public hasUnsavedChanges(): boolean {
    return this.autosave.dirty();
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    const parsed = newBusinessSchema.safeParse(BusinessDrafts.draftValues(this.draft()));
    if (!parsed.success) {
      this.errors.set(FormErrors.fieldErrors(parsed.error.issues));
      this.errorKey.set('businessPanel.form.fixErrors');
      FormErrors.focusFirstError(this.document, BusinessDrafts.basicsFieldOrder(ID_PREFIX), this.errors());
      return;
    }
    this.errors.set({});
    this.errorKey.set(null);
    this.saving.set(true);
    const result = await this.repo.create(parsed.data);
    this.saving.set(false);
    if (!result.data) {
      this.errorKey.set(result.errorKey);
      return;
    }
    this.autosave.saved();
    this.toast.show({ messageKey: 'businessPanel.register.created', tone: 'success' });
    await this.context.load();
    // The wizard takes the owner through the rest (location, hours, legal data, menu).
    await this.router.navigate(['/owner', result.data, 'setup']);
  }
}

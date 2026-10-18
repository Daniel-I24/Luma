import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, ToastService } from '@design-system';
import { ownerPaths } from '@shared/account/owner-paths';
import { newBusinessSchema } from '@shared/business/data/business-write.schemas';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { type FieldErrors, fieldErrors, focusFirstError } from '@shared/forms/form-errors';
import { BusinessBasicsFields } from '../../components/business-basics-fields/business-basics-fields';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { OwnerContextStore } from '../../state/owner-context.store';
import { EMPTY_DRAFT, basicsFieldOrder, draftValues } from '../../utils/business-draft.util';

const ID_PREFIX = 'register';

/** RegisterBusinessPage — /owner/new: creates an unpublished draft business (at most 3). */
@Component({
  selector: 'app-register-business-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, BusinessBasicsFields, PanelHeader],
  templateUrl: './register-business.page.html',
  host: { class: 'block' },
})
export class RegisterBusinessPage {
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

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    const parsed = newBusinessSchema.safeParse(draftValues(this.draft()));
    if (!parsed.success) {
      this.errors.set(fieldErrors(parsed.error.issues));
      this.errorKey.set('businessPanel.form.fixErrors');
      focusFirstError(this.document, basicsFieldOrder(ID_PREFIX), this.errors());
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
    this.toast.show({ messageKey: 'businessPanel.register.created', tone: 'success' });
    await this.context.load();
    await this.router.navigate(ownerPaths.section(result.data, 'summary'));
  }
}

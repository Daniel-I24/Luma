import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { TextRules } from '@core/validation/text-rules';
import { LumaButton, LumaInput, ToastService } from '@design-system';
import { type BusinessInfoInput, businessInfoSchema } from '@shared/business/data/business-write.schemas';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { DraftNotice } from '@shared/forms/draft-notice/draft-notice';
import { FormDraftStore } from '@shared/forms/form-draft.store';
import { type FieldErrors, FormErrors } from '@shared/forms/form-errors';
import type { HasUnsavedChanges } from '@shared/forms/unsaved-changes.guard';
import { BusinessBasicsFields } from '../../components/business-basics-fields/business-basics-fields';
import { BusinessImages } from '../../components/business-images/business-images';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { PanelStateView } from '../../components/panel-state/panel-state';
import { ReReviewSheet } from '../../components/re-review-sheet/re-review-sheet';
import { PanelBusinessStore } from '../../state/panel-business.store';
import { EMPTY_DRAFT, BusinessDrafts } from '../../utils/business-draft';
import { ReReview } from '../../utils/publication-rules';
import { RouteBusinessId } from '../../utils/route-business-id';
import { SetupReturn } from '../../components/setup-return/setup-return';

const ID_PREFIX = 'info';
const DESCRIPTION_MAX = 300;
const DESCRIPTION_RULE = TextRules.freeText(DESCRIPTION_MAX);

/** BusinessInfoPage — /owner/:id/business/info: basics, description and preparation time. */
@Component({
  selector: 'app-business-info-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SetupReturn, TranslocoModule, LumaButton, LumaInput, BusinessBasicsFields, BusinessImages, PanelHeader,
    PanelStateView, ReReviewSheet, DraftNotice,
  ],
  providers: [PanelBusinessStore],
  templateUrl: './business-info.page.html',
  host: { class: 'block' },
})
export class BusinessInfoPage implements HasUnsavedChanges {
  protected readonly panel = inject(PanelBusinessStore);
  private readonly repo = inject(OwnedBusinessRepository);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  protected readonly id = RouteBusinessId.routeBusinessId((id) => this.load(id));

  protected readonly idPrefix = ID_PREFIX;
  protected readonly descriptionMax = DESCRIPTION_MAX;
  protected readonly draft = signal(EMPTY_DRAFT);
  protected readonly description = signal('');
  protected readonly prepMinutes = signal('20');
  protected readonly errors = signal<FieldErrors>({});
  protected readonly errorKey = signal<string | null>(null);
  protected readonly saving = signal(false);
  /** Values waiting for the owner to accept going back to review. */
  protected readonly pendingSave = signal<BusinessInfoInput | null>(null);
  protected readonly autosave = inject(FormDraftStore).attachTo(
    () => ({ basics: this.draft(), description: this.description(), prepMinutes: this.prepMinutes() }),
    (value) => {
      this.draft.set(value.basics);
      this.description.set(value.description);
      this.prepMinutes.set(value.prepMinutes);
    },
  );

  protected async load(id = this.id()): Promise<void> {
    await this.panel.load(id);
    const business = this.panel.business();
    if (!business) return;
    this.autosave.load(`business-info.${business.id}`, {
      basics: BusinessDrafts.draftFrom(business),
      description: business.description ?? '',
      prepMinutes: String(business.prep_minutes),
    });
  }

  /** For the leave warning (unsavedChangesGuard). */
  public hasUnsavedChanges(): boolean {
    return this.autosave.dirty();
  }

  protected onDescription(event: Event): void {
    this.description.set((event.target as HTMLTextAreaElement).value);
    this.errors.update((errors) => FormErrors.withoutErrors(errors, 'description'));
  }

  protected checkDescription(): void {
    FormErrors.blur(this.errors, 'description', DESCRIPTION_RULE, this.description());
  }

  protected onPrepMinutes(value: string): void {
    this.prepMinutes.set(value);
    this.errors.update((errors) => FormErrors.withoutErrors(errors, 'prep_minutes'));
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    const parsed = businessInfoSchema.safeParse({
      ...BusinessDrafts.draftValues(this.draft()),
      description: this.description().trim() || null,
      prep_minutes: Number(this.prepMinutes()),
    });
    if (!parsed.success) {
      this.errors.set(FormErrors.fieldErrors(parsed.error.issues));
      this.errorKey.set('businessPanel.form.fixErrors');
      FormErrors.focusFirstError(this.document, BusinessDrafts.infoFieldOrder(ID_PREFIX), this.errors());
      return;
    }
    this.errors.set({});
    this.errorKey.set(null);
    const business = this.panel.business();
    if (business && ReReview.changesNeedReReview(business, parsed.data)) {
      this.pendingSave.set(parsed.data);
      return;
    }
    await this.persist(parsed.data);
  }

  /** Confirmed in the re-review sheet. */
  protected async confirmReReview(): Promise<void> {
    const input = this.pendingSave();
    this.pendingSave.set(null);
    if (input) await this.persist(input, true);
  }

  private async persist(input: BusinessInfoInput, reReview = false): Promise<void> {
    this.saving.set(true);
    const result = await this.repo.updateInfo(this.id(), input);
    this.saving.set(false);
    this.errorKey.set(result.errorKey);
    if (result.errorKey) return;
    this.autosave.saved();
    if (reReview) await this.load();
    else this.panel.patch(input);
    this.toast.show({ messageKey: reReview ? 'owner.reReview.saved' : 'businessPanel.form.saved', tone: 'success' });
  }
}

import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaInput, ToastService } from '@design-system';
import {
  type BusinessInfoInput,
  businessInfoSchema,
} from '@shared/business/data/business-write.schemas';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import {
  type FieldErrors,
  fieldErrors,
  focusFirstError,
  withoutErrors,
} from '@shared/forms/form-errors';
import { BusinessBasicsFields } from '../../components/business-basics-fields/business-basics-fields';
import { BusinessImages } from '../../components/business-images/business-images';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { PanelStateView } from '../../components/panel-state/panel-state';
import { ReReviewSheet } from '../../components/re-review-sheet/re-review-sheet';
import { PanelBusinessStore } from '../../state/panel-business.store';
import {
  EMPTY_DRAFT,
  draftFrom,
  draftValues,
  infoFieldOrder,
} from '../../utils/business-draft.util';
import { changesNeedReReview } from '../../utils/re-review.util';
import { routeBusinessId } from '../../utils/route-business-id';

const ID_PREFIX = 'info';
export const DESCRIPTION_MAX = 300;

/** BusinessInfoPage — /owner/:id/business/info: basics, description and preparation time. */
@Component({
  selector: 'app-business-info-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaButton,
    LumaInput,
    BusinessBasicsFields,
    BusinessImages,
    PanelHeader,
    PanelStateView,
    ReReviewSheet,
  ],
  providers: [PanelBusinessStore],
  templateUrl: './business-info.page.html',
  host: { class: 'block' },
})
export class BusinessInfoPage {
  protected readonly panel = inject(PanelBusinessStore);
  private readonly repo = inject(OwnedBusinessRepository);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  protected readonly id = routeBusinessId();

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

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.load(id));
    });
  }

  protected async load(id = this.id()): Promise<void> {
    await this.panel.load(id);
    const business = this.panel.business();
    if (!business) return;
    this.draft.set(draftFrom(business));
    this.description.set(business.description ?? '');
    this.prepMinutes.set(String(business.prep_minutes));
  }

  protected onDescription(event: Event): void {
    this.description.set((event.target as HTMLTextAreaElement).value);
    this.errors.update((errors) => withoutErrors(errors, 'description'));
  }

  protected onPrepMinutes(value: string): void {
    this.prepMinutes.set(value);
    this.errors.update((errors) => withoutErrors(errors, 'prep_minutes'));
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    const parsed = businessInfoSchema.safeParse({
      ...draftValues(this.draft()),
      description: this.description().trim() || null,
      prep_minutes: Number(this.prepMinutes()),
    });
    if (!parsed.success) {
      this.errors.set(fieldErrors(parsed.error.issues));
      this.errorKey.set('businessPanel.form.fixErrors');
      focusFirstError(this.document, infoFieldOrder(ID_PREFIX), this.errors());
      return;
    }
    this.errors.set({});
    this.errorKey.set(null);
    const business = this.panel.business();
    if (business && changesNeedReReview(business, parsed.data)) {
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
    if (result.errorKey) {
      this.errorKey.set(result.errorKey);
      return;
    }
    if (reReview) await this.load();
    else this.panel.patch(input);
    this.toast.show({
      messageKey: reReview ? 'owner.reReview.saved' : 'businessPanel.form.saved',
      tone: 'success',
    });
  }
}

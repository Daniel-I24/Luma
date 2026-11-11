import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { DateRules } from '@core/validation/number-rules';
import { TextRules } from '@core/validation/text-rules';
import { LumaButton, LumaInput } from '@design-system';
import { DiscountFields } from '../discount-fields/discount-fields';
import { ImageField } from '../image-field/image-field';
import { MAX_DESCRIPTION_LENGTH, type PromotionInput, promotionSchema } from '@shared/business/data/business-write.schemas';
import type { Promotion } from '@shared/business/models/business.model';
import type { MenuItem } from '@shared/business/models/menu.model';
import { DraftNotice } from '@shared/forms/draft-notice/draft-notice';
import { DraftForm } from '@shared/forms/draft-form';
import { FormErrors } from '@shared/forms/form-errors';
import { PromotionPhases } from '../../utils/promotion-phase';
import { type PromoDraft, type PromotionPrefill, PromotionDrafts } from './promotion-draft';
import { DateTimeFields } from '../date-time-fields/date-time-fields';

const FIELD_ORDER = [
  ['title', 'promo-title'],
  ['starts_at', 'promo-starts'],
  ['ends_at', 'promo-ends'],
  ['description', 'promo-description'],
  ['menu_item_id', 'promo-item'],
  ['discount_percent', 'promo-percent'],
] as const;

/** Draft field -> validated field, to clear its error on edit. */
const DRAFT_FIELD: Record<string, string> = {
  startsAt: 'starts_at',
  endsAt: 'ends_at',
  menuItemId: 'menu_item_id',
  discount: 'discount_percent',
};

/** Checked when the owner leaves each field (the same rules as on save and in the database). */
const RULES = { title: TextRules.promotionTitle, description: TextRules.freeText(MAX_DESCRIPTION_LENGTH) } as const;

/**
 * PromotionForm — create or edit a promotion; the end must be after the start
 * and in the future. What is typed is kept as a device draft until saved.
 */
@Component({
  selector: 'app-promotion-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaInput, DiscountFields, ImageField, DraftNotice, DateTimeFields],
  templateUrl: './promotion-form.html',
})
export class PromotionForm {
  private readonly document = inject(DOCUMENT);

  public readonly promotion = input<Promotion | null>(null);
  public readonly prefill = input<PromotionPrefill | null>(null);
  public readonly businessId = input.required<string>();
  /** Products of the business that a discount can apply to. */
  public readonly items = input<readonly MenuItem[]>([]);
  public readonly busy = input(false);
  public readonly submitted = output<PromotionInput>();
  public readonly cancelled = output<void>();

  protected readonly rules = RULES;
  private readonly form = new DraftForm<PromoDraft>(PromotionDrafts.draftOf(null, new Date(), null), DRAFT_FIELD);
  protected readonly draft = this.form.draft;
  protected readonly errors = this.form.errors;
  protected readonly autosave = this.form.autosave;

  constructor() {
    effect(() => {
      const promotion = this.promotion();
      const prefill = this.prefill();
      const businessId = this.businessId();
      untracked(() => {
        const formId = `promotion.${businessId}.${promotion?.id ?? (prefill ? 'idea' : 'new')}`;
        this.form.load(formId, PromotionDrafts.draftOf(promotion, new Date(), prefill));
      });
    });
  }

  /** True while the form holds changes that were not saved. */
  public hasChanges(): boolean {
    return this.autosave.dirty();
  }

  /** Called by the page once the server saved it: the draft is forgotten. */
  public markSaved(): void {
    this.autosave.saved();
  }

  protected set<K extends keyof PromoDraft>(field: K, value: PromoDraft[K]): void {
    this.form.set(field, value);
  }

  protected check(field: keyof typeof RULES, raw: string): void {
    this.form.check(field, RULES[field], raw);
  }

  protected onDescription(event: Event): void {
    this.set('description', (event.target as HTMLTextAreaElement).value);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const draft = this.draft();
    const parsed = promotionSchema.safeParse({
      title: draft.title,
      description: draft.description.trim() || null,
      starts_at: PromotionPhases.fromLocalInput(draft.startsAt),
      ends_at: PromotionPhases.fromLocalInput(draft.endsAt),
      image_url: draft.imageUrl,
      menu_item_id: draft.menuItemId,
      discount_percent: draft.discount.trim() ? Number(draft.discount) : null,
    });
    const errors = parsed.success ? {} : { ...FormErrors.fieldErrors(parsed.error.issues) };
    const period = parsed.success ? DateRules.period(parsed.data.starts_at, parsed.data.ends_at, Date.now(), true) : null;
    if (period) Object.assign(errors, { ends_at: period });
    this.errors.set(errors);
    if (!parsed.success || Object.keys(errors).length) {
      FormErrors.focusFirstError(this.document, FIELD_ORDER, errors);
      return;
    }
    this.submitted.emit(parsed.data);
  }
}

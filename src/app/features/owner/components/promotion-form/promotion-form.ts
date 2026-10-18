import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaInput } from '@design-system';
import { DiscountFields } from '../discount-fields/discount-fields';
import { ImageField } from '../image-field/image-field';
import { type PromotionInput, promotionSchema } from '@shared/business/data/business-write.schemas';
import type { Promotion } from '@shared/business/models/business.model';
import type { MenuItem } from '@shared/business/models/menu.model';
import {
  type FieldErrors,
  fieldErrors,
  focusFirstError,
  withoutErrors,
} from '@shared/forms/form-errors';
import { fromLocalInput, toLocalInput } from '../../utils/promotion-phase.util';

const FIELD_ORDER = [
  ['title', 'promo-title'],
  ['starts_at', 'promo-starts'],
  ['ends_at', 'promo-ends'],
  ['description', 'promo-description'],
  ['menu_item_id', 'promo-item'],
  ['discount_percent', 'promo-percent'],
] as const;
const DAY_MS = 86_400_000;

/** Draft field -> validated field, to clear its error on edit. */
const DRAFT_FIELD: Record<string, string> = {
  startsAt: 'starts_at',
  endsAt: 'ends_at',
  menuItemId: 'menu_item_id',
  discount: 'discount_percent',
};

interface PromoDraft {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  imageUrl: string | null;
  menuItemId: string | null;
  discount: string;
}

function draftOf(promotion: Promotion | null, now: Date): PromoDraft {
  return {
    title: promotion?.title ?? '',
    description: promotion?.description ?? '',
    startsAt: toLocalInput(promotion?.starts_at ?? now.toISOString()),
    endsAt: toLocalInput(promotion?.ends_at ?? new Date(now.getTime() + 7 * DAY_MS).toISOString()),
    imageUrl: promotion?.image_url ?? null,
    menuItemId: promotion?.menu_item_id ?? null,
    discount: promotion?.discount_percent?.toString() ?? '',
  };
}

/** PromotionForm — create or edit a promotion; the end must be after the start and in the future. */
@Component({
  selector: 'app-promotion-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaInput, DiscountFields, ImageField],
  templateUrl: './promotion-form.html',
})
export class PromotionForm {
  private readonly document = inject(DOCUMENT);

  readonly promotion = input<Promotion | null>(null);
  readonly businessId = input.required<string>();
  /** Products of the business that a discount can apply to. */
  readonly items = input<readonly MenuItem[]>([]);
  readonly busy = input(false);
  readonly submitted = output<PromotionInput>();
  readonly cancelled = output<void>();

  protected readonly draft = signal<PromoDraft>(draftOf(null, new Date()));
  protected readonly errors = signal<FieldErrors>({});

  constructor() {
    effect(() => {
      const promotion = this.promotion();
      untracked(() => {
        this.draft.set(draftOf(promotion, new Date()));
        this.errors.set({});
      });
    });
  }

  protected set<K extends keyof PromoDraft>(field: K, value: PromoDraft[K]): void {
    this.draft.update((draft) => ({ ...draft, [field]: value }));
    this.errors.update((errors) => withoutErrors(errors, DRAFT_FIELD[field] ?? field));
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
      starts_at: fromLocalInput(draft.startsAt),
      ends_at: fromLocalInput(draft.endsAt),
      image_url: draft.imageUrl,
      menu_item_id: draft.menuItemId,
      discount_percent: draft.discount.trim() ? Number(draft.discount) : null,
    });
    const errors = parsed.success ? {} : { ...fieldErrors(parsed.error.issues) };
    if (parsed.success && Date.parse(parsed.data.ends_at) <= Date.now()) {
      Object.assign(errors, { ends_at: 'businessPanel.validation.endsInPast' });
    }
    this.errors.set(errors);
    if (!parsed.success || Object.keys(errors).length) {
      focusFirstError(this.document, FIELD_ORDER, errors);
      return;
    }
    this.submitted.emit(parsed.data);
  }
}

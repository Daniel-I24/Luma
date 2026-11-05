import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, untracked } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { NumberRules } from '@core/validation/number-rules';
import { TextRules } from '@core/validation/text-rules';
import { LumaButton, LumaInput } from '@design-system';
import { ImageField } from '../image-field/image-field';
import { MAX_DESCRIPTION_LENGTH, type MenuItemInput, menuItemSchema } from '@shared/business/data/business-write.schemas';
import type { MenuItem } from '@shared/business/models/menu.model';
import { DraftNotice } from '@shared/forms/draft-notice/draft-notice';
import { DraftForm } from '@shared/forms/draft-form';
import { FormErrors } from '@shared/forms/form-errors';

const FIELD_ORDER = [
  ['name', 'menu-item-name'],
  ['price_cop', 'menu-item-price'],
  ['section', 'menu-item-section'],
  ['description', 'menu-item-description'],
] as const;

/** Checked when the owner leaves each field (the same rules as on save and in the database). */
const RULES = {
  name: TextRules.productName,
  price_cop: NumberRules.price,
  section: TextRules.menuSection,
  description: TextRules.freeText(MAX_DESCRIPTION_LENGTH),
} as const;

/** Draft field -> validated field, to clear its error on edit. */
const DRAFT_FIELD: Record<string, string> = { price: 'price_cop' };

interface ItemDraft {
  name: string;
  description: string;
  price: string;
  section: string;
  available: boolean;
  imageUrl: string | null;
}

const EMPTY_DRAFT: ItemDraft = {
  name: '',
  description: '',
  price: '',
  section: '',
  available: true,
  imageUrl: null,
};

function draftOf(item: MenuItem | null): ItemDraft {
  if (!item) return EMPTY_DRAFT;
  return {
    name: item.name,
    description: item.description ?? '',
    price: String(item.price_cop),
    section: item.section ?? '',
    available: item.is_available,
    imageUrl: item.image_url ?? null,
  };
}

/**
 * MenuItemForm — create or edit one product; emits validated values. Its
 * place in the menu is set by moving it in the list, not by a number here.
 * What is typed is kept as a device draft until saved.
 */
@Component({
  selector: 'app-menu-item-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaInput, ImageField, DraftNotice],
  templateUrl: './menu-item-form.html',
})
export class MenuItemForm {
  private readonly document = inject(DOCUMENT);

  /** Item being edited, or null for a new one. */
  public readonly item = input<MenuItem | null>(null);
  public readonly businessId = input.required<string>();
  /** Where a new product goes: after the last one. */
  public readonly nextOrder = input(0);
  public readonly busy = input(false);
  public readonly submitted = output<MenuItemInput>();
  public readonly cancelled = output<void>();

  protected readonly rules = RULES;
  private readonly form = new DraftForm<ItemDraft>(draftOf(null), DRAFT_FIELD);
  protected readonly draft = this.form.draft;
  protected readonly errors = this.form.errors;
  protected readonly autosave = this.form.autosave;

  constructor() {
    effect(() => {
      const item = this.item();
      const businessId = this.businessId();
      untracked(() => this.form.load(`menu-item.${businessId}.${item?.id ?? 'new'}`, draftOf(item)));
    });
  }

  /** True while the form holds changes that were not saved. */
  public hasChanges(): boolean {
    return this.autosave.dirty();
  }

  /** Called by the page once the server saved it. */
  public markSaved(): void {
    this.autosave.saved();
  }

  protected set<K extends keyof ItemDraft>(field: K, value: ItemDraft[K]): void {
    this.form.set(field, value);
  }

  protected onAvailable(event: Event): void {
    this.set('available', (event.target as HTMLInputElement).checked);
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
    const parsed = menuItemSchema.safeParse({
      name: draft.name,
      description: draft.description.trim() || null,
      price_cop: draft.price.trim() === '' ? Number.NaN : Number(draft.price),
      section: draft.section.trim() || null,
      sort_order: this.item()?.sort_order ?? this.nextOrder(),
      is_available: draft.available,
      image_url: draft.imageUrl,
    });
    if (!parsed.success) {
      this.errors.set(FormErrors.fieldErrors(parsed.error.issues));
      FormErrors.focusFirstError(this.document, FIELD_ORDER, this.errors());
      return;
    }
    this.errors.set({});
    this.submitted.emit(parsed.data);
  }
}

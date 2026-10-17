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
import { type MenuItemInput, menuItemSchema } from '@shared/business/data/business-write.schemas';
import type { MenuItem } from '@shared/business/models/menu.model';
import {
  type FieldErrors,
  fieldErrors,
  focusFirstError,
  withoutErrors,
} from '@shared/forms/form-errors';

const FIELD_ORDER = [
  ['name', 'menu-item-name'],
  ['price_cop', 'menu-item-price'],
  ['section', 'menu-item-section'],
  ['sort_order', 'menu-item-order'],
  ['description', 'menu-item-description'],
] as const;

/** Draft field -> validated field, to clear its error on edit. */
const DRAFT_FIELD: Record<string, string> = { price: 'price_cop', sortOrder: 'sort_order' };

interface ItemDraft {
  name: string;
  description: string;
  price: string;
  section: string;
  sortOrder: string;
  available: boolean;
}

function draftOf(item: MenuItem | null): ItemDraft {
  return {
    name: item?.name ?? '',
    description: item?.description ?? '',
    price: item ? String(item.price_cop) : '',
    section: item?.section ?? '',
    sortOrder: String(item?.sort_order ?? 0),
    available: item?.is_available ?? true,
  };
}

/** MenuItemForm — create or edit one product; emits validated values. */
@Component({
  selector: 'app-menu-item-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaInput],
  templateUrl: './menu-item-form.html',
})
export class MenuItemForm {
  private readonly document = inject(DOCUMENT);

  /** Item being edited, or null for a new one. */
  readonly item = input<MenuItem | null>(null);
  readonly busy = input(false);
  readonly submitted = output<MenuItemInput>();
  readonly cancelled = output<void>();

  protected readonly draft = signal<ItemDraft>(draftOf(null));
  protected readonly errors = signal<FieldErrors>({});

  constructor() {
    effect(() => {
      const item = this.item();
      untracked(() => {
        this.draft.set(draftOf(item));
        this.errors.set({});
      });
    });
  }

  protected set<K extends keyof ItemDraft>(field: K, value: ItemDraft[K]): void {
    this.draft.update((draft) => ({ ...draft, [field]: value }));
    this.errors.update((errors) => withoutErrors(errors, DRAFT_FIELD[field] ?? field));
  }

  protected onAvailable(event: Event): void {
    this.set('available', (event.target as HTMLInputElement).checked);
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
      sort_order: Number(draft.sortOrder || 0),
      is_available: draft.available,
      image_url: this.item()?.image_url ?? null,
    });
    if (!parsed.success) {
      this.errors.set(fieldErrors(parsed.error.issues));
      focusFirstError(this.document, FIELD_ORDER, this.errors());
      return;
    }
    this.errors.set({});
    this.submitted.emit(parsed.data);
  }
}

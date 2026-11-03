import { Injectable, computed, inject, signal } from '@angular/core';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { MenuWriteRepository } from '@shared/business/data/menu-write.repository';
import { type DraftItem, MenuScanRepository } from '../services/menu-scan.repository';

/** One line of the draft as the owner reviews it (texts as typed). */
export interface ReviewItem {
  readonly key: number;
  readonly name: string;
  readonly price: string;
  readonly section: string;
  readonly description: string | null;
  readonly selected: boolean;
}

export type ScanPhase = 'pick' | 'reading' | 'review' | 'saving' | 'done';

const toReview = (item: DraftItem, key: number): ReviewItem => ({
  key,
  name: item.name,
  price: item.price_cop === null ? '' : String(item.price_cop),
  section: item.section ?? '',
  description: item.description,
  // Without a readable price the owner must type it before keeping the item.
  selected: item.price_cop !== null,
});

/** A whole, positive price in COP from what the owner typed ("12.500" → 12500). */
export function priceOf(text: string): number | null {
  const digits = text.replace(/[.\s$]/g, '');
  return /^\d{1,9}$/.test(digits) && Number(digits) > 0 ? Number(digits) : null;
}

/** MenuScanStore — photos → draft → review → the chosen items saved to the menu. */
@Injectable()
export class MenuScanStore {
  private readonly scanner = inject(MenuScanRepository);
  private readonly reader = inject(MenuRepository);
  private readonly writer = inject(MenuWriteRepository);

  private readonly _phase = signal<ScanPhase>('pick');
  private readonly _items = signal<readonly ReviewItem[]>([]);
  private readonly _errorKey = signal<string | null>(null);
  private readonly _saved = signal(0);

  readonly phase = this._phase.asReadonly();
  readonly items = this._items.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();
  readonly saved = this._saved.asReadonly();
  readonly chosen = computed(() => this._items().filter((i) => i.selected && i.name.trim() && priceOf(i.price)));

  async read(businessId: string, files: readonly File[]): Promise<void> {
    if (!files.length) return;
    this._phase.set('reading');
    this._errorKey.set(null);
    const result = await this.scanner.scan(businessId, files);
    if (!result.items) {
      this._errorKey.set(result.errorKey);
      this._phase.set('pick');
      return;
    }
    this._items.set(result.items.map(toReview));
    this._phase.set('review');
    if (result.items.length === 0) this._errorKey.set('owner.menuScan.nothingFound');
  }

  edit(key: number, changes: Partial<Omit<ReviewItem, 'key'>>): void {
    this._items.update((items) => items.map((i) => (i.key === key ? { ...i, ...changes } : i)));
  }

  /** Saves the chosen items after the current menu, one by one; stops at the first refusal. */
  async save(businessId: string): Promise<void> {
    const chosen = this.chosen();
    if (!chosen.length) return;
    this._phase.set('saving');
    this._errorKey.set(null);
    const menu = await this.reader.getMenu(businessId);
    let order = (menu.data ?? []).reduce((max, item) => Math.max(max, item.sort_order + 1), 0);
    let saved = 0;
    for (const item of chosen) {
      const result = await this.writer.create(businessId, {
        name: item.name.trim(),
        description: item.description,
        price_cop: priceOf(item.price) ?? 0,
        section: item.section.trim() || null,
        sort_order: Math.min(order++, 9999),
        is_available: true,
        image_url: null,
      });
      if (result.errorKey) {
        this._errorKey.set(result.errorKey);
        break;
      }
      saved++;
      this._items.update((items) => items.filter((i) => i.key !== item.key));
    }
    this._saved.set(saved);
    this._phase.set(this._errorKey() ? 'review' : 'done');
  }

  restart(): void {
    this._items.set([]);
    this._errorKey.set(null);
    this._saved.set(0);
    this._phase.set('pick');
  }
}

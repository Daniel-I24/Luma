import { Injectable, computed, inject, signal } from '@angular/core';
import { NumberRules } from '@core/validation/number-rules';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { MenuWriteRepository } from '@shared/business/data/menu-write.repository';
import { type DraftItem, MenuScanRepository } from '../services/menu-scan.repository';
import { MAX_SORT_ORDER } from '@shared/business/data/business-write.schemas';
import { MenuTextParser } from '../utils/menu-text-parser';

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

/** ScanPrices — reads prices from scanned menu text. */
export class ScanPrices {
  /** A whole price in COP from what the owner typed ("$ 12.500" → 12500), within menu_items_price_range. */
  public static priceOf(text: string): number | null {
    const digits = NumberRules.price.normalize(text);
    return NumberRules.price.spec.isSatisfiedBy(digits) ? Number(digits) : null;
  }
}

const SATURATED_KEY = 'owner.menuScan.errors.providerSaturated';

/**
 * MenuScanStore — photos (Luma IA) or pasted text (MenuTextParser, free and
 * local) → draft → review → the chosen items saved to the menu.
 */
@Injectable()
export class MenuScanStore {
  private readonly scanner = inject(MenuScanRepository);
  private readonly reader = inject(MenuRepository);
  private readonly writer = inject(MenuWriteRepository);

  private readonly _phase = signal<ScanPhase>('pick');
  private readonly _items = signal<readonly ReviewItem[]>([]);
  private readonly _errorKey = signal<string | null>(null);
  private readonly _saved = signal(0);
  /** The last photos read, for "Reintentar" when Luma IA was saturated. */
  private last: { readonly businessId: string; readonly files: readonly File[] } | null = null;

  public readonly phase = this._phase.asReadonly();
  public readonly items = this._items.asReadonly();
  public readonly errorKey = this._errorKey.asReadonly();
  public readonly saved = this._saved.asReadonly();
  /** The provider was saturated: the same photos can be tried again in a moment. */
  public readonly retryable = computed(() => this._errorKey() === SATURATED_KEY);
  public readonly chosen = computed(() => this._items().filter((i) => i.selected && i.name.trim() && ScanPrices.priceOf(i.price)));

  /** Reads menu photos into reviewable items. */
  public async read(businessId: string, files: readonly File[]): Promise<void> {
    if (!files.length) return;
    this.last = { businessId, files };
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

  /** Reads the last photos again (after a saturated provider). */
  public async retry(): Promise<void> {
    if (this.last) await this.read(this.last.businessId, this.last.files);
  }

  /** Plan B without Luma IA: the menu pasted as text goes to the same review. */
  public fromText(text: string): void {
    const items = MenuTextParser.parse(text);
    this._errorKey.set(items.length ? null : 'owner.menuScan.nothingFound');
    if (!items.length) return;
    this._items.set(items.map(toReview));
    this._phase.set('review');
  }

  /** Edits one scanned item before saving. */
  public edit(key: number, changes: Partial<Omit<ReviewItem, 'key'>>): void {
    this._items.update((items) => items.map((i) => (i.key === key ? { ...i, ...changes } : i)));
  }

  /** Saves the chosen items after the current menu, one by one; stops at the first refusal. */
  public async save(businessId: string): Promise<void> {
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
        price_cop: ScanPrices.priceOf(item.price) ?? 0,
        section: item.section.trim() || null,
        sort_order: Math.min(order++, MAX_SORT_ORDER),
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

  /** Starts a new scan. */
  public restart(): void {
    this._items.set([]);
    this._errorKey.set(null);
    this._saved.set(0);
    this._phase.set('pick');
  }
}

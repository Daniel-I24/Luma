import { Injectable, computed, inject, signal } from '@angular/core';
import type { MenuItemInput } from '@shared/business/data/business-write.schemas';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { MenuWriteRepository } from '@shared/business/data/menu-write.repository';
import type { MenuItem } from '@shared/business/models/menu.model';
import { BusinessImageRepository } from '@shared/media/business-image.repository';
import { type MenuSection, MenuSections } from '../utils/menu-sections';

/** MenuPanelStore — the full menu of the managed business and its edits. */
@Injectable()
export class MenuPanelStore {
  private readonly reader = inject(MenuRepository);
  private readonly writer = inject(MenuWriteRepository);
  private readonly images = inject(BusinessImageRepository);

  private readonly _items = signal<readonly MenuItem[]>([]);
  private readonly _busy = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  public readonly busy = this._busy.asReadonly();
  public readonly errorKey = this._errorKey.asReadonly();
  public readonly isEmpty = computed(() => this._items().length === 0);
  /** sort_order of a new product: after the last one. */
  public readonly nextOrder = computed(() => this._items().reduce((max, item) => Math.max(max, item.sort_order + 1), 0));

  /** Items grouped by section (named sections first), each in the owner's order. */
  public readonly sections = computed<MenuSection[]>(() => MenuSections.group(this._items()));

  /** Resolves to false when the menu could not be loaded. */
  public async load(businessId: string): Promise<boolean> {
    const result = await this.reader.getMenu(businessId);
    this._items.set(result.data ?? []);
    return !result.errorKey;
  }

  /** Creates (no id) or updates an item; a replaced picture is deleted once saved. */
  public async save(businessId: string, id: string | null, input: MenuItemInput): Promise<boolean> {
    return this.run(async () => {
      const result = id
        ? await this.writer.update(id, input)
        : await this.writer.create(businessId, input);
      const previous = this._items().find((item) => item.id === id)?.image_url;
      if (result.data) {
        this.upsert(result.data);
        if (previous && previous !== result.data.image_url) await this.images.remove(previous);
      }
      return result.errorKey;
    });
  }

  /** Marks a menu item available or sold out; true when saved. */
  public async setAvailable(item: MenuItem, available: boolean): Promise<boolean> {
    return this.run(async () => {
      const result = await this.writer.setAvailable(item.id, available);
      if (result.data) this.upsert({ ...item, is_available: available });
      return result.errorKey;
    });
  }

  /** Inline change of name or price, without the product form. */
  public async patch(item: MenuItem, changes: Partial<Pick<MenuItem, 'name' | 'price_cop'>>): Promise<boolean> {
    return this.run(async () => {
      const result = await this.writer.update(item.id, MenuSections.inputOf({ ...item, ...changes }));
      if (result.data) this.upsert(result.data);
      return result.errorKey;
    });
  }

  /**
   * Moves an item to the place of another one of its section (up/down
   * buttons and drag). The section keeps its own sort_order values, in the
   * new order; only the items whose value changes are written.
   */
  public async move(itemId: string, targetId: string): Promise<boolean> {
    const section = this.sections().find((s) => s.items.some((i) => i.id === itemId));
    const from = section?.items.findIndex((i) => i.id === itemId) ?? -1;
    const to = section?.items.findIndex((i) => i.id === targetId) ?? -1;
    if (!section || from < 0 || to < 0 || from === to) return false;
    const order = [...section.items];
    order.splice(to, 0, ...order.splice(from, 1));
    const values = section.items.map((i) => i.sort_order).sort((a, b) => a - b);
    // Equal values (old menus) become consecutive so the new order holds.
    const slots = values.map((v, index) => Math.max(v, (values[0] ?? 0) + index));
    const changed = order.map((item, index) => ({ ...item, sort_order: slots[index] })).filter((item, index) => item.sort_order !== order[index].sort_order);
    return this.run(async () => {
      for (const item of changed) {
        const result = await this.writer.update(item.id, MenuSections.inputOf(item));
        if (result.errorKey) return result.errorKey;
        this.upsert(result.data ?? item);
      }
      return null;
    });
  }

  /** Deletes an item and then its picture. */
  public async remove(id: string): Promise<boolean> {
    return this.run(async () => {
      const image = this._items().find((item) => item.id === id)?.image_url;
      const result = await this.writer.remove(id);
      if (result.data) {
        this._items.update((items) => items.filter((item) => item.id !== id));
        await this.images.remove(image);
      }
      return result.errorKey;
    });
  }

  /** Clears the last error. */
  public clearError(): void {
    this._errorKey.set(null);
  }

  private upsert(item: MenuItem): void {
    this._items.update((items) =>
      items.some((i) => i.id === item.id)
        ? items.map((i) => (i.id === item.id ? item : i))
        : [...items, item],
    );
  }

  private async run(action: () => Promise<string | null>): Promise<boolean> {
    if (this._busy()) return false;
    this._busy.set(true);
    this._errorKey.set(null);
    try {
      const errorKey = await action();
      this._errorKey.set(errorKey);
      return errorKey === null;
    } finally {
      this._busy.set(false);
    }
  }
}

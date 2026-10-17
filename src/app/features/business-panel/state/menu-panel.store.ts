import { Injectable, computed, inject, signal } from '@angular/core';
import type { MenuItemInput } from '@shared/business/data/business-write.schemas';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { MenuWriteRepository } from '@shared/business/data/menu-write.repository';
import type { MenuItem } from '@shared/business/models/menu.model';

export interface MenuSection {
  /** null for items without a section. */
  readonly name: string | null;
  readonly items: readonly MenuItem[];
}

/** MenuPanelStore — the full menu of the managed business and its edits. */
@Injectable()
export class MenuPanelStore {
  private readonly reader = inject(MenuRepository);
  private readonly writer = inject(MenuWriteRepository);

  private readonly _items = signal<readonly MenuItem[]>([]);
  private readonly _busy = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  readonly busy = this._busy.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();
  readonly isEmpty = computed(() => this._items().length === 0);

  /** Items grouped by section (named sections first), each in the owner's order. */
  readonly sections = computed<MenuSection[]>(() => {
    const groups = new Map<string | null, MenuItem[]>();
    const sorted = [...this._items()].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    );
    for (const item of sorted)
      groups.set(item.section, [...(groups.get(item.section) ?? []), item]);
    return [...groups]
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => (a.name === null ? 1 : b.name === null ? -1 : a.name.localeCompare(b.name)));
  });

  /** Resolves to false when the menu could not be loaded. */
  async load(businessId: string): Promise<boolean> {
    const result = await this.reader.getMenu(businessId);
    this._items.set(result.data ?? []);
    return !result.errorKey;
  }

  /** Creates (no id) or updates an item; resolves to true when saved. */
  async save(businessId: string, id: string | null, input: MenuItemInput): Promise<boolean> {
    return this.run(async () => {
      const result = id
        ? await this.writer.update(id, input)
        : await this.writer.create(businessId, input);
      if (result.data) this.upsert(result.data);
      return result.errorKey;
    });
  }

  async setAvailable(item: MenuItem, available: boolean): Promise<boolean> {
    return this.run(async () => {
      const result = await this.writer.setAvailable(item.id, available);
      if (result.data) this.upsert({ ...item, is_available: available });
      return result.errorKey;
    });
  }

  async remove(id: string): Promise<boolean> {
    return this.run(async () => {
      const result = await this.writer.remove(id);
      if (result.data) this._items.update((items) => items.filter((item) => item.id !== id));
      return result.errorKey;
    });
  }

  clearError(): void {
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

import type { MenuItemInput } from '@shared/business/data/business-write.schemas';
import type { MenuItem } from '@shared/business/models/menu.model';

export interface MenuSection {
  /** null for items without a section. */
  readonly name: string | null;
  readonly items: readonly MenuItem[];
}

/** MenuSections — the owner's menu grouped by section, and a product as write input. */
export class MenuSections {
  /** Named sections first (alphabetical), then items without a section; each in the owner's order. */
  public static group(items: readonly MenuItem[]): MenuSection[] {
    const groups = new Map<string | null, MenuItem[]>();
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    for (const item of sorted) groups.set(item.section, [...(groups.get(item.section) ?? []), item]);
    return [...groups]
      .map(([name, list]) => ({ name, items: list }))
      .sort((a, b) => (a.name === null ? 1 : b.name === null ? -1 : a.name.localeCompare(b.name)));
  }

  /** Every field of a product, for an update that changes only some of them. */
  public static inputOf(item: MenuItem): MenuItemInput {
    return {
      name: item.name, description: item.description, price_cop: item.price_cop, section: item.section,
      sort_order: item.sort_order, is_available: item.is_available, image_url: item.image_url ?? null,
    };
  }
}

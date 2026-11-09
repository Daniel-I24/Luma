import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaEmptyState, LumaImage, LumaRefreshButton } from '@design-system';
import type { IconName } from '@design-system';
import type { MenuItem } from '@shared/business/models/menu.model';
import { AddToCart } from '@shared/cart/add-to-cart/add-to-cart';
import { CartMath } from '@shared/cart/cart.model';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';

export interface MenuSection {
  /** Null for items without a section ("Otros"). */
  name: string | null;
  items: MenuItem[];
}

/** MenuSections — groups menu items by section, in menu order. */
export class MenuSections {
  /** Groups menu items by section, keeping the order in which sections appear. */
  public static groupBySection(items: readonly MenuItem[]): MenuSection[] {
    const sections = new Map<string | null, MenuItem[]>();
    for (const item of items) {
      const key = item.section?.trim() || null;
      sections.set(key, [...(sections.get(key) ?? []), item]);
    }
    return [...sections].map(([name, list]) => ({ name, items: list }));
  }
}


/**
 * MenuTab — the business menu grouped by section, with prices in COP and
 * "Agregar" to put items in the cart.
 */
@Component({
  selector: 'app-menu-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaRefreshButton, TranslocoModule, LumaEmptyState, LumaImage, CopCurrencyPipe, AddToCart],
  templateUrl: './menu-tab.html',
  host: { class: 'block' },
})
export class MenuTab {
  /** Null when the menu failed to load. */
  public readonly items = input.required<readonly MenuItem[] | null>();
  public readonly placeholderIcon = input<IconName>('store');
  public readonly businessName = input.required<string>();

  public readonly retry = output<void>();

  protected readonly sections = computed(() => MenuSections.groupBySection(this.items() ?? []));
  protected readonly products = computed(
    () => new Map((this.items() ?? []).map((i) => [i.id, CartMath.toCartProduct(i, this.businessName())])),
  );
}

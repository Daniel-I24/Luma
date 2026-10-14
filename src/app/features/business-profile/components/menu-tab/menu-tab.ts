import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaEmptyState, LumaIcon } from '@design-system';
import type { IconName } from '@design-system';
import type { MenuItem } from '@shared/business/models/menu.model';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';

export interface MenuSection {
  /** Null for items without a section ("Otros"). */
  name: string | null;
  items: MenuItem[];
}

/** Groups menu items by section, keeping the order in which sections appear. */
export function groupBySection(items: readonly MenuItem[]): MenuSection[] {
  const sections = new Map<string | null, MenuItem[]>();
  for (const item of items) {
    const key = item.section?.trim() || null;
    sections.set(key, [...(sections.get(key) ?? []), item]);
  }
  return [...sections].map(([name, list]) => ({ name, items: list }));
}

/**
 * MenuTab — the business menu grouped by section, with prices in COP.
 * Ordering is not built yet, so "Agregar" stays disabled ("Próximamente").
 */
@Component({
  selector: 'app-menu-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaEmptyState, LumaIcon, CopCurrencyPipe],
  templateUrl: './menu-tab.html',
  host: { class: 'block' },
})
export class MenuTab {
  /** Null when the menu failed to load. */
  readonly items = input.required<readonly MenuItem[] | null>();
  readonly placeholderIcon = input<IconName>('store');

  readonly retry = output<void>();

  protected readonly sections = computed(() => groupBySection(this.items() ?? []));
}

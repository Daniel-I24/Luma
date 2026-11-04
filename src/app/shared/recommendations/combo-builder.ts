import type { MenuItem } from '@shared/business/models/menu.model';
import { SearchText } from '@shared/business/utils/search-text';
import type { MomentComboConfig } from './moment-combos.config';
import { SECTION_ROLES } from './recommendation-rules';
import type { Combo, ComboRole, MomentCombo, RecommendationCandidate } from './recommendation.model';

const ROLES: readonly ComboRole[] = ['main', 'side', 'drink'];

/** ComboBuilder — builds a combo from a business menu. */
export class ComboBuilder {
  /** Role of a menu section from the dictionary, or null when it has none. */
  public static sectionRole(section: string | null): ComboRole | null {
    if (!section) return null;
    const words = SearchText.normalize(section).split(/\s+/);
    const match = SECTION_ROLES.find(([keyword]) => words.some((w) => w.startsWith(keyword)));
    return match?.[1] ?? null;
  }

  /**
   * Main + side + drink from one business: the first available item of each
   * role in the owner's menu order; null when a role is missing.
   */
  public static buildCombo(candidate: RecommendationCandidate): Combo | null {
    const ordered = [...candidate.menu]
      .filter((item) => item.is_available)
      .sort((a, b) => a.sort_order - b.sort_order);
    const picked: Partial<Record<ComboRole, MenuItem>> = {};
    for (const item of ordered) {
      const role = ComboBuilder.sectionRole(item.section);
      if (role && !picked[role]) picked[role] = item;
    }
    if (!ROLES.every((role) => picked[role])) return null;
    const items = picked as Record<ComboRole, MenuItem>;
    return {
      business: candidate.business,
      items,
      totalCop: ROLES.reduce((sum, role) => sum + items[role].price_cop, 0),
    };
  }

  /**
   * A combo for a moment of the day (MOMENT_COMBOS): a dish and a drink,
   * plus an extra when there is one, all available, in the owner's menu
   * order; `skipDishes` leaves out dishes already used. Null without both.
   */
  public static momentCombo(candidate: RecommendationCandidate, config: MomentComboConfig, skipDishes: ReadonlySet<string> = new Set()): MomentCombo | null {
    const ordered = [...candidate.menu].filter((item) => item.is_available).sort((a, b) => a.sort_order - b.sort_order);
    const matches = (item: MenuItem, keywords: readonly string[]): boolean => {
      const words = SearchText.normalize(`${item.section ?? ''} ${item.name}`).split(/\s+/);
      return keywords.some((keyword) => words.some((w) => w.startsWith(keyword)));
    };
    const dish = ordered.find((item) => !skipDishes.has(item.id) && matches(item, config.dish));
    const drink = ordered.find((item) => item !== dish && matches(item, config.drink));
    if (!dish || !drink) return null;
    const extra = ordered.find((item) => item !== dish && item !== drink && matches(item, config.extra)) ?? null;
    return {
      business: candidate.business,
      distanceKm: candidate.distanceKm,
      dish, drink, extra,
      totalCop: dish.price_cop + drink.price_cop + (extra?.price_cop ?? 0),
    };
  }
}

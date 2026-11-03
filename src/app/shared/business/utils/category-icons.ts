import type { IconName } from '@design-system';
import { TextNormalizer } from '@shared/utils/text-normalizer';

/** Keyword (accent-insensitive prefix) → icon, checked in order. */
const CATEGORY_ICONS: readonly [string, IconName][] = [
  ['panad', 'bread'],
  ['pasteler', 'bread'],
  ['bakery', 'bread'],
  ['cafe', 'coffee'],
  ['coffee', 'coffee'],
  ['pizz', 'pizza'],
  ['hambur', 'burger'],
  ['burger', 'burger'],
  ['restaur', 'utensils'],
  ['comida', 'utensils'],
  ['cocina', 'utensils'],
];

/** CategoryIcons — the icon of each business category. */
export class CategoryIcons {
  /**
   * Icon that stands in for a missing business logo, from its category
   * (free text in the database). Unknown categories use the store icon.
   */
  public static categoryIcon(category: string): IconName {
    const words = TextNormalizer.normalizeText(category).split(/\s+/);
    const match = CATEGORY_ICONS.find(([keyword]) => words.some((w) => w.startsWith(keyword)));
    return match?.[1] ?? 'store';
  }
}


/**
 * Closed list of business categories. `value` is what the database stores
 * (CHECK businesses_category_valid, kept in sync by
 * scripts/business-categories.test.mjs); `key` names its translation under
 * `businessCategories`.
 */
export const BUSINESS_CATEGORIES = [
  { value: 'Restaurante', key: 'restaurant' },
  { value: 'Cafetería', key: 'cafe' },
  { value: 'Panadería', key: 'bakery' },
  { value: 'Pastelería', key: 'pastry' },
  { value: 'Heladería', key: 'iceCream' },
  { value: 'Pizzería', key: 'pizza' },
  { value: 'Hamburguesería', key: 'burger' },
  { value: 'Comida rápida', key: 'fastFood' },
  { value: 'Bar', key: 'bar' },
  { value: 'Tienda', key: 'store' },
] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number]['value'];

export const BUSINESS_CATEGORY_VALUES = BUSINESS_CATEGORIES.map((c) => c.value) as [
  BusinessCategory,
  ...BusinessCategory[],
];

/** Translation key of a stored category, or null for legacy free-text values. */
export function categoryLabelKey(value: string): string | null {
  const category = BUSINESS_CATEGORIES.find((c) => c.value === value);
  return category ? `businessCategories.${category.key}` : null;
}

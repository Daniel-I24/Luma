import type { Business } from '@shared/business/models/business.model';
import { normalizeText } from '@shared/utils/normalize-text.util';

/** Distinct categories of the loaded businesses, alphabetically. */
export function extractCategories(businesses: readonly Business[]): string[] {
  const unique = new Set(businesses.map((b) => b.category.trim()).filter(Boolean));
  return [...unique].sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Client-side search over already loaded businesses: every word of the
 * query must appear in the name, category or address.
 */
export function filterBusinesses(businesses: readonly Business[], query: string): Business[] {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  return businesses.filter((b) => {
    const haystack = normalizeText(`${b.name} ${b.category} ${b.address}`);
    return words.every((word) => haystack.includes(word));
  });
}

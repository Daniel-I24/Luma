import type { Business } from '@shared/business/models/business.model';
import { SearchText } from '@shared/business/utils/search-text';

/** BusinessFilter — text and category filtering of nearby businesses. */
export class BusinessFilter {
  /** Distinct categories of the loaded businesses, alphabetically. */
  public static extractCategories(businesses: readonly Business[]): string[] {
    const unique = new Set(businesses.map((b) => b.category.trim()).filter(Boolean));
    return [...unique].sort((a, b) => a.localeCompare(b, 'es'));
  }

  /**
   * Client-side search over already loaded businesses: every word of the
   * query must appear in the name, category or address.
   */
  public static filterBusinesses(businesses: readonly Business[], query: string): Business[] {
    const words = SearchText.normalize(query).split(/\s+/).filter(Boolean);
    return businesses.filter((b) => {
      const haystack = SearchText.normalize(`${b.name} ${b.category} ${b.address}`);
      return words.every((word) => haystack.includes(word));
    });
  }
}


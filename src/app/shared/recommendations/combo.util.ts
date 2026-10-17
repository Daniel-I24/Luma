import type { MenuItem } from '@shared/business/models/menu.model';
import { normalizeText } from '@shared/utils/normalize-text.util';
import { SECTION_ROLES } from './recommendation-rules';
import type { Combo, ComboRole, RecommendationCandidate } from './recommendation.model';

const ROLES: readonly ComboRole[] = ['main', 'side', 'drink'];

/** Role of a menu section from the dictionary, or null when it has none. */
export function sectionRole(section: string | null): ComboRole | null {
  if (!section) return null;
  const words = normalizeText(section).split(/\s+/);
  const match = SECTION_ROLES.find(([keyword]) => words.some((w) => w.startsWith(keyword)));
  return match?.[1] ?? null;
}

/**
 * Main + side + drink from one business: the first available item of each
 * role in the owner's menu order; null when a role is missing.
 */
export function buildCombo(candidate: RecommendationCandidate): Combo | null {
  const ordered = [...candidate.menu]
    .filter((item) => item.is_available)
    .sort((a, b) => a.sort_order - b.sort_order);
  const picked: Partial<Record<ComboRole, MenuItem>> = {};
  for (const item of ordered) {
    const role = sectionRole(item.section);
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

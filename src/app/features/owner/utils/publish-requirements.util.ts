import { BUSINESS_CATEGORY_VALUES } from '@shared/business/data/business-categories';
import type { Business, BusinessHours } from '@shared/business/models/business.model';
import type { MenuItem } from '@shared/business/models/menu.model';

/** What a business needs before it can be published (in display order). */
export const PUBLISH_REQUIREMENTS = [
  'name',
  'category',
  'location',
  'openDay',
  'availableItem',
] as const;
export type PublishRequirement = (typeof PUBLISH_REQUIREMENTS)[number];

/**
 * Requirements still missing. The database enforces the open day and the
 * available item when publishing; the rest is guaranteed by its CHECKs.
 */
export function missingRequirements(
  business: Pick<Business, 'name' | 'category' | 'latitude' | 'longitude'>,
  hours: readonly Pick<BusinessHours, 'is_closed'>[],
  items: readonly Pick<MenuItem, 'is_available'>[],
): PublishRequirement[] {
  const met: Record<PublishRequirement, boolean> = {
    name: business.name.trim().length >= 2,
    category: (BUSINESS_CATEGORY_VALUES as readonly string[]).includes(business.category),
    location:
      Number.isFinite(business.latitude) &&
      Number.isFinite(business.longitude) &&
      !(business.latitude === 0 && business.longitude === 0),
    openDay: hours.some((day) => !day.is_closed),
    availableItem: items.some((item) => item.is_available),
  };
  return PUBLISH_REQUIREMENTS.filter((requirement) => !met[requirement]);
}

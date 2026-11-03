import { BUSINESS_CATEGORY_VALUES } from '@shared/business/data/business-categories';
import type { Business, BusinessHours } from '@shared/business/models/business.model';
import type { MenuItem } from '@shared/business/models/menu.model';
import { MIN_NAME_LENGTH } from '@shared/business/data/business-write.schemas';

/** What a business needs before it can be published (in display order). */
const PUBLISH_REQUIREMENTS = [
  'name',
  'category',
  'location',
  'openDay',
  'availableItem',
] as const;
export type PublishRequirement = (typeof PUBLISH_REQUIREMENTS)[number];

/** PublishRequirements — what a business still needs before publishing. */
export class PublishRequirements {
  /**
   * Requirements still missing. The database enforces the open day and the
   * available item when publishing; the rest is guaranteed by its CHECKs.
   */
  public static missingRequirements(
    business: Pick<Business, 'name' | 'category' | 'latitude' | 'longitude'>,
    hours: readonly Pick<BusinessHours, 'is_closed'>[],
    items: readonly Pick<MenuItem, 'is_available'>[],
  ): PublishRequirement[] {
    const met: Record<PublishRequirement, boolean> = {
      name: business.name.trim().length >= MIN_NAME_LENGTH,
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
}

type Identity = Pick<Business, 'name' | 'address' | 'latitude' | 'longitude'>;

/** ReReview — which edits send a verified business back to review. */
export class ReReview {
  /**
   * True when saving these values sends a verified business back to review:
   * the database re-reviews it (and hides it) when the owner changes its name,
   * address or location.
   */
  public static changesNeedReReview(
    business: Identity & Pick<Business, 'verification_status'>,
    next: Identity,
  ): boolean {
    if (business.verification_status !== 'approved') return false;
    return (
      business.name !== next.name ||
      business.address !== next.address ||
      business.latitude !== next.latitude ||
      business.longitude !== next.longitude
    );
  }
}

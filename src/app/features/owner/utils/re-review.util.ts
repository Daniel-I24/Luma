import type { Business } from '@shared/business/models/business.model';

type Identity = Pick<Business, 'name' | 'address' | 'latitude' | 'longitude'>;

/**
 * True when saving these values sends a verified business back to review:
 * the database re-reviews it (and hides it) when the owner changes its name,
 * address or location.
 */
export function changesNeedReReview(
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

import type { IconName } from '@design-system';
import type { Business, BusinessStatus } from '@shared/business/models/business.model';
import type { MenuItem } from '@shared/business/models/menu.model';

/** One full-screen post of the feed: an active promotion or an available dish. */
export interface FeedCard {
  /** Unique across kinds, e.g. "promotion:p1" or "dish:m4". */
  id: string;
  kind: 'promotion' | 'dish';
  title: string;
  description: string | null;
  imageUrl: string | null;
  /** Whole COP; dishes only (after their best current discount). */
  priceCop: number | null;
  /** Menu price when a discount lowers priceCop; null otherwise. */
  listPriceCop: number | null;
  /** Percent off (promotion cards and discounted dishes); null otherwise. */
  discountPercent: number | null;
  /** ISO end of a promotion; null for dishes. */
  validUntil: string | null;
  business: Business;
  status: BusinessStatus;
  /** Straight-line km from the user; null without a real location. */
  distanceKm: number | null;
  /** Fallback visual when there is no image. */
  icon: IconName;
  /** The dish itself (null for promotions), e.g. to add it to the cart. */
  menuItem: MenuItem | null;
}

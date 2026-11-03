import type { Promotion } from '@shared/business/models/business.model';
import { PromotionPhases } from '../../utils/promotion-phase';

const DAY_MS = 86_400_000;

/** What the promotion form edits; dates as datetime-local strings. */
export interface PromoDraft {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  imageUrl: string | null;
  menuItemId: string | null;
  discount: string;
}

/** Values from a Luma IA idea, for a new promotion the owner reviews. */
export interface PromotionPrefill {
  readonly title: string;
  readonly menuItemId: string;
  readonly discountPercent: number;
  readonly durationDays: number;
}

/** A new promotion lasts a week unless Luma IA suggested otherwise. */
const DEFAULT_DURATION_DAYS = 7;

/** PromotionDrafts — the editable draft of a promotion. */
export class PromotionDrafts {
  /** The form draft for an existing promotion, a Luma IA idea or a new one. */
  public static draftOf(
    promotion: Promotion | null,
    now: Date,
    prefill: PromotionPrefill | null,
  ): PromoDraft {
    if (promotion) return PromotionDrafts.fromPromotion(promotion);
    return prefill ? PromotionDrafts.fromPrefill(prefill, now) : PromotionDrafts.empty(now);
  }

  private static fromPromotion(promotion: Promotion): PromoDraft {
    return {
      title: promotion.title,
      description: promotion.description ?? '',
      startsAt: PromotionPhases.toLocalInput(promotion.starts_at),
      endsAt: PromotionPhases.toLocalInput(promotion.ends_at),
      imageUrl: promotion.image_url ?? null,
      menuItemId: promotion.menu_item_id ?? null,
      discount: promotion.discount_percent?.toString() ?? '',
    };
  }

  private static fromPrefill(prefill: PromotionPrefill, now: Date): PromoDraft {
    return {
      ...PromotionDrafts.empty(now, prefill.durationDays),
      title: prefill.title,
      menuItemId: prefill.menuItemId,
      discount: String(prefill.discountPercent),
    };
  }

  private static empty(now: Date, durationDays = DEFAULT_DURATION_DAYS): PromoDraft {
    return {
      title: '',
      description: '',
      startsAt: PromotionPhases.toLocalInput(now.toISOString()),
      endsAt: PromotionPhases.toLocalInput(new Date(now.getTime() + durationDays * DAY_MS).toISOString()),
      imageUrl: null,
      menuItemId: null,
      discount: '',
    };
  }
}


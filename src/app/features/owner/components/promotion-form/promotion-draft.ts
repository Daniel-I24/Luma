import type { Promotion } from '@shared/business/models/business.model';
import { toLocalInput } from '../../utils/promotion-phase.util';

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

export function draftOf(
  promotion: Promotion | null,
  now: Date,
  prefill: PromotionPrefill | null,
): PromoDraft {
  if (!promotion && prefill) {
    return {
      title: prefill.title,
      description: '',
      startsAt: toLocalInput(now.toISOString()),
      endsAt: toLocalInput(new Date(now.getTime() + prefill.durationDays * DAY_MS).toISOString()),
      imageUrl: null,
      menuItemId: prefill.menuItemId,
      discount: String(prefill.discountPercent),
    };
  }
  return {
    title: promotion?.title ?? '',
    description: promotion?.description ?? '',
    startsAt: toLocalInput(promotion?.starts_at ?? now.toISOString()),
    endsAt: toLocalInput(promotion?.ends_at ?? new Date(now.getTime() + 7 * DAY_MS).toISOString()),
    imageUrl: promotion?.image_url ?? null,
    menuItemId: promotion?.menu_item_id ?? null,
    discount: promotion?.discount_percent?.toString() ?? '',
  };
}

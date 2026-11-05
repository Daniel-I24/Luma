import type { Promotion } from '@shared/business/models/business.model';

/** PromotionPick — which promotion the map shows for each business. */
export class PromotionPick {
  /** The biggest discount per business, else the first promotion. */
  public static firstPerBusiness(promotions: readonly Promotion[]): Map<string, Promotion> {
    const byBusiness = new Map<string, Promotion>();
    const off = (p: Promotion): number => (p.menu_item_id ? (p.discount_percent ?? 0) : 0);
    for (const promo of promotions) {
      const current = byBusiness.get(promo.business_id);
      if (!current || off(promo) > off(current)) byBusiness.set(promo.business_id, promo);
    }
    return byBusiness;
  }
}

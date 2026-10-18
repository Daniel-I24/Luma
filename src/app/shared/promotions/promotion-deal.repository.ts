import { Injectable, inject } from '@angular/core';
import * as z from 'zod/mini';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '@shared/business/data/business.repository';
import type { BusinessHours } from '@shared/business/models/business.model';
import { type PromotionDeal, promotionPrice } from './promotion-deal';

const LOAD_FAILED = 'promotions.errors.loadFailed';
const SELECT = `id, title, description, image_url, starts_at, ends_at, discount_percent,
  businesses!inner(id, name, category, latitude, longitude,
    business_hours(day_of_week, opens_at, closes_at, is_closed)),
  menu_items(id, name, image_url, price_cop, is_available)`;

const rowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.nullable(z.string()),
  image_url: z.nullable(z.string()),
  starts_at: z.string(),
  ends_at: z.string(),
  discount_percent: z.nullable(z.number()),
  businesses: z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    business_hours: z.array(
      z.object({
        day_of_week: z.number(),
        opens_at: z.string(),
        closes_at: z.string(),
        is_closed: z.boolean(),
      }),
    ),
  }),
  menu_items: z.nullable(
    z.object({
      id: z.string(),
      name: z.string(),
      image_url: z.nullable(z.string()),
      price_cop: z.number(),
      is_available: z.boolean(),
    }),
  ),
});
type DealRow = z.infer<typeof rowSchema>;

/** A deal with its business hours, for the "abierto ahora" filter. */
export interface DealWithHours {
  readonly deal: PromotionDeal;
  readonly hours: readonly Pick<
    BusinessHours,
    'day_of_week' | 'opens_at' | 'closes_at' | 'is_closed'
  >[];
}

/** Contract: current promotions as customers see them (Supabase is one implementation). */
@Injectable({ providedIn: 'root', useFactory: () => new SupabasePromotionDealRepository() })
export abstract class PromotionDealRepository {
  /** Current promotions of public businesses (RLS decides what is public). */
  abstract listCurrent(): Promise<RepoResult<DealWithHours[]>>;
  abstract listForBusiness(businessId: string): Promise<RepoResult<DealWithHours[]>>;
}

export class SupabasePromotionDealRepository extends PromotionDealRepository {
  private readonly db = inject(SupabaseService).client;

  listCurrent(): Promise<RepoResult<DealWithHours[]>> {
    return this.read();
  }

  listForBusiness(businessId: string): Promise<RepoResult<DealWithHours[]>> {
    return this.read(businessId);
  }

  private async read(businessId?: string): Promise<RepoResult<DealWithHours[]>> {
    const now = new Date().toISOString();
    let query = this.db
      .from('promotions')
      .select(SELECT)
      .eq('is_active', true)
      .lte('starts_at', now)
      .gte('ends_at', now)
      .limit(200);
    if (businessId) query = query.eq('business_id', businessId);
    const { data, error } = await query;
    if (error) return { data: null, errorKey: LOAD_FAILED };
    const parsed = z.array(rowSchema).safeParse(data);
    if (!parsed.success) return { data: null, errorKey: LOAD_FAILED };
    return { data: parsed.data.map(toDeal), errorKey: null };
  }
}

function toDeal(row: DealRow): DealWithHours {
  const item = row.menu_items;
  const percent = item ? row.discount_percent : null;
  const { business_hours: hours, ...business } = row.businesses;
  return {
    // day_of_week is 0-6 (CHECK in the database); Zod reads it as a number.
    hours: hours as DealWithHours['hours'],
    deal: {
      id: row.id,
      title: row.title,
      description: row.description,
      imageUrl: row.image_url ?? item?.image_url ?? null,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      discountPercent: percent,
      item: item && {
        id: item.id,
        name: item.name,
        imageUrl: item.image_url,
        listCop: item.price_cop,
        finalCop: promotionPrice(item.price_cop, percent),
        available: item.is_available,
      },
      business,
    },
  };
}

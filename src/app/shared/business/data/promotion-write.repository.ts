import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { Promotion } from '../models/business.model';
import type { RepoResult } from './business.repository';
import { mapWriteError } from './business-write-error';
import { type PromotionInput, promotionSchema } from './business-write.schemas';

const INVALID = 'businessPanel.errors.invalidData';
const SAVE_FAILED = 'businessPanel.errors.saveFailed';

/**
 * PromotionWriteRepository — every promotion of the user's business
 * (scheduled, running or ended: owner read policy) and its writes.
 */
@Injectable({ providedIn: 'root' })
export class PromotionWriteRepository {
  private readonly db = inject(SupabaseService).client;

  /** All promotions of the business, newest start first. */
  async listForOwner(businessId: string): Promise<RepoResult<Promotion[]>> {
    const { data, error } = await this.db
      .from('promotions')
      .select('*')
      .eq('business_id', businessId)
      .order('starts_at', { ascending: false });
    if (error) return { data: null, errorKey: 'businessPanel.errors.loadFailed' };
    return { data: data as Promotion[], errorKey: null };
  }

  async create(businessId: string, input: PromotionInput): Promise<RepoResult<Promotion>> {
    const parsed = promotionSchema.safeParse(input);
    if (!parsed.success) return { data: null, errorKey: INVALID };
    const { data, error } = await this.db
      .from('promotions')
      .insert({ ...parsed.data, business_id: businessId, is_active: true })
      .select('*')
      .single();
    if (error) return { data: null, errorKey: mapWriteError(error, SAVE_FAILED) };
    return { data: data as Promotion, errorKey: null };
  }

  async update(id: string, input: PromotionInput): Promise<RepoResult<Promotion>> {
    const parsed = promotionSchema.safeParse(input);
    if (!parsed.success) return { data: null, errorKey: INVALID };
    const { data, error } = await this.db
      .from('promotions')
      .update(parsed.data)
      .eq('id', id)
      .select('*')
      .single();
    if (error) return { data: null, errorKey: mapWriteError(error, SAVE_FAILED) };
    return { data: data as Promotion, errorKey: null };
  }

  /**
   * Ends a promotion now: it stops showing and stays in the history. One
   * that has not started keeps its dates (ends_at must stay after starts_at).
   */
  async end(
    promotion: Pick<Promotion, 'id' | 'starts_at'>,
    now: Date = new Date(),
  ): Promise<RepoResult<true>> {
    const started = Date.parse(promotion.starts_at) < now.getTime();
    const { error } = await this.db
      .from('promotions')
      .update(started ? { is_active: false, ends_at: now.toISOString() } : { is_active: false })
      .eq('id', promotion.id);
    if (error) return { data: null, errorKey: mapWriteError(error, SAVE_FAILED) };
    return { data: true, errorKey: null };
  }
}

import { Injectable, inject } from '@angular/core';
import * as z from 'zod/mini';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from './business.repository';
import { mapWriteError } from './business-write-error';
import { type DayHoursInput, dayHoursSchema } from './business-write.schemas';

const weekSchema = z.array(dayHoursSchema).check(
  z.length(7),
  z.refine((days) => new Set(days.map((d) => d.day_of_week)).size === 7),
);

/**
 * BusinessHoursWriteRepository — saves the whole week of a business in one
 * upsert: one row per day (unique business_id + day_of_week). Reads use
 * BusinessRepository.getHours (owners read their unpublished hours too).
 */
@Injectable({ providedIn: 'root' })
export class BusinessHoursWriteRepository {
  private readonly db = inject(SupabaseService).client;

  async saveWeek(businessId: string, week: readonly DayHoursInput[]): Promise<RepoResult<true>> {
    const parsed = weekSchema.safeParse(week);
    if (!parsed.success) return { data: null, errorKey: 'businessPanel.errors.invalidData' };
    const rows = parsed.data.map((day) => ({ ...day, business_id: businessId }));
    const { error } = await this.db
      .from('business_hours')
      .upsert(rows, { onConflict: 'business_id,day_of_week' });
    if (error)
      return { data: null, errorKey: mapWriteError(error, 'businessPanel.errors.saveFailed') };
    return { data: true, errorKey: null };
  }
}

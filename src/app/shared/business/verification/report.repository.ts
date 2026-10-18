import { Injectable, inject } from '@angular/core';
import * as z from 'zod/mini';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '../data/business.repository';
import { REPORT_REASONS, type ReportReason } from './verification.model';

const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  comment: z.nullable(z.string().check(z.trim(), z.maxLength(300, 'reports.validation.comment'))),
});

/** Contract: a user's reports about a business (Supabase is one implementation). */
@Injectable({ providedIn: 'root', useFactory: () => new SupabaseReportRepository() })
export abstract class ReportRepository {
  abstract create(
    businessId: string,
    reason: ReportReason,
    comment: string | null,
  ): Promise<RepoResult<true>>;
}

export class SupabaseReportRepository extends ReportRepository {
  private readonly db = inject(SupabaseService).client;

  async create(
    businessId: string,
    reason: ReportReason,
    comment: string | null,
  ): Promise<RepoResult<true>> {
    const parsed = reportSchema.safeParse({ reason, comment: comment?.trim() || null });
    if (!parsed.success) return { data: null, errorKey: parsed.error.issues[0].message };
    const { error } = await this.db
      .from('reports')
      .insert({ business_id: businessId, ...parsed.data });
    if (!error) return { data: true, errorKey: null };
    // One open report per user and business: a second one is already "received".
    if (error.code === '23505') return { data: null, errorKey: 'reports.errors.alreadyReported' };
    return { data: null, errorKey: 'reports.errors.failed' };
  }
}

import { Injectable, inject } from '@angular/core';
import * as z from 'zod/mini';
import { SupabaseService } from '@core/supabase/supabase.service';
import { TextRules } from '@core/validation/text-rules';
import { ZodRules } from '@core/validation/zod-rules';
import type { RepoResult } from '../data/business.repository';
import { REPORT_REASONS, type ReportReason } from './verification.model';

/** reports_comment_rule: clean text of at most 300 characters. */
const MAX_REPORT_COMMENT = 300;
export const REPORT_COMMENT_RULE = TextRules.freeText(MAX_REPORT_COMMENT);

const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  comment: ZodRules.optionalText(REPORT_COMMENT_RULE),
});

/** Contract: a user's reports about a business (Supabase is one implementation). */
@Injectable({ providedIn: 'root', useFactory: () => new SupabaseReportRepository() })
export abstract class ReportRepository {
  /** Reports a business to the admins. */
  public abstract create(
    businessId: string,
    reason: ReportReason,
    comment: string | null,
  ): Promise<RepoResult<true>>;
}

/** SupabaseReportRepository — reports through RLS. */
class SupabaseReportRepository extends ReportRepository {
  private readonly db = inject(SupabaseService).client;

  /** @inheritdoc */
  public async create(
    businessId: string,
    reason: ReportReason,
    comment: string | null,
  ): Promise<RepoResult<true>> {
    const parsed = reportSchema.safeParse({ reason, comment });
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

import { InjectionToken, inject } from '@angular/core';
import { AI_MODE } from '@core/config/ai-mode';
import { SupabaseService } from '@core/supabase/supabase.service';
import { OwnerSalesRepository } from './owner-sales.repository';
import { type IdeasResult, ideasResultSchema } from './promotion-idea';
import { ruleIdeas } from './rules-promotion-ideas';

/** Promotion ideas for an owner's business. The owner always reviews and publishes. */
export interface PromotionAdvisor {
  /** Throws when the ideas cannot be produced (the UI shows its error state). */
  suggest(businessId: string): Promise<IdeasResult>;
}

type Db = SupabaseService['client'];

/** In the app: the owner's sales aggregates and the rules (no external service). */
export class RulesPromotionAdvisor implements PromotionAdvisor {
  constructor(private readonly sales: OwnerSalesRepository) {}

  async suggest(businessId: string): Promise<IdeasResult> {
    const [summary, promoted] = await Promise.all([
      this.sales.summary(businessId),
      this.sales.promotedItems(businessId),
    ]);
    if (!summary.data || !promoted.data) throw new Error('ideas_unavailable');
    return { source: 'rules', ideas: ruleIdeas(summary.data, promoted.data) };
  }
}

/** Through the suggest-promotions Edge Function (LLM gateway, rules below 10 orders). */
export class RemotePromotionAdvisor implements PromotionAdvisor {
  constructor(private readonly db: Db) {}

  async suggest(businessId: string): Promise<IdeasResult> {
    const { data, error } = await this.db.functions.invoke('suggest-promotions', {
      method: 'POST',
      body: { business_id: businessId },
    });
    const parsed = ideasResultSchema.safeParse(data);
    if (error || !parsed.success) throw new Error('ai_unavailable');
    return parsed.data;
  }
}

/** Remote first; on any failure, the rules in the app. */
export class FallbackPromotionAdvisor implements PromotionAdvisor {
  constructor(
    private readonly primary: PromotionAdvisor,
    private readonly fallback: PromotionAdvisor,
  ) {}

  async suggest(businessId: string): Promise<IdeasResult> {
    try {
      return await this.primary.suggest(businessId);
    } catch {
      return this.fallback.suggest(businessId);
    }
  }
}

export const PROMOTION_ADVISOR = new InjectionToken<PromotionAdvisor>('PROMOTION_ADVISOR', {
  providedIn: 'root',
  factory: () => {
    const rules = new RulesPromotionAdvisor(inject(OwnerSalesRepository));
    if (inject(AI_MODE) !== 'remote') return rules;
    return new FallbackPromotionAdvisor(
      new RemotePromotionAdvisor(inject(SupabaseService).client),
      rules,
    );
  },
});

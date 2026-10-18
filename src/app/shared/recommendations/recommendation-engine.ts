import { InjectionToken, inject } from '@angular/core';
import { AI_MODE } from '@core/config/ai-mode';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { Recommendation, RecommendationRequest } from './recommendation.model';
import {
  FallbackRecommendationEngine,
  RemoteRecommendationEngine,
} from './remote-recommendation.engine';
import { RulesRecommendationEngine } from './rules-recommendation.engine';

/**
 * RecommendationEngine — picks businesses and a combo for a moment of the
 * day. Rules in the app by default; with AI_MODE "remote", the recommend
 * Edge Function with the rules as fallback (docs/ai.md).
 */
export interface RecommendationEngine {
  recommend(request: RecommendationRequest): Promise<Recommendation>;
}

export const RECOMMENDATION_ENGINE = new InjectionToken<RecommendationEngine>(
  'RECOMMENDATION_ENGINE',
  {
    providedIn: 'root',
    factory: () => {
      const rules = new RulesRecommendationEngine();
      if (inject(AI_MODE) !== 'remote') return rules;
      return new FallbackRecommendationEngine(
        new RemoteRecommendationEngine(inject(SupabaseService).client),
        rules,
      );
    },
  },
);

import { InjectionToken } from '@angular/core';
import type { Recommendation, RecommendationRequest } from './recommendation.model';
import { RulesRecommendationEngine } from './rules-recommendation.engine';

/**
 * RecommendationEngine — picks businesses and a combo for a moment of the
 * day. Today: rules (RulesRecommendationEngine). Later: Claude behind an Edge
 * Function, with the same contract (docs/ai.md). Async on purpose so that
 * swap needs no caller changes.
 */
export interface RecommendationEngine {
  recommend(request: RecommendationRequest): Promise<Recommendation>;
}

export const RECOMMENDATION_ENGINE = new InjectionToken<RecommendationEngine>(
  'RECOMMENDATION_ENGINE',
  { providedIn: 'root', factory: () => new RulesRecommendationEngine() },
);

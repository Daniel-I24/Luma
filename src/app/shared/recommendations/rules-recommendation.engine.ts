import { TextNormalizer } from '@shared/utils/text-normalizer';
import { ComboBuilder } from './combo-builder';
import type { RecommendationEngine } from './recommendation-engine';
import {
  DAY_MOMENTS,
  type DayMoment,
  type Recommendation,
  type RecommendationCandidate,
  type RecommendationReason,
  type RecommendationRequest,
  type RecommendedBusiness,
} from './recommendation.model';
import {
  MAX_RECOMMENDATIONS,
  MAX_USEFUL_KM,
  MOMENT_CATEGORIES,
  MOMENT_START_HOUR,
  NEAR_KM,
  RECOMMENDABLE_STATUSES,
  TOP_RATING,
  WEIGHTS,
} from './recommendation-rules';
import { MAX_RATING } from '@shared/business/data/review.schema';

/** Scores keep one decimal. */
const SCORE_PRECISION = 10;

/** RecommendationScoring — moment of the day and candidate scores. */
export class RecommendationScoring {
  /** The moment a given hour (0–23) belongs to; nights wrap past midnight. */
  public static momentForHour(hour: number): DayMoment {
    const started = DAY_MOMENTS.filter((moment) => MOMENT_START_HOUR[moment] <= hour);
    return started.at(-1) ?? 'night';
  }

  /** True when a category fits the moment of the day. */
  public static suitsMoment(category: string, moment: DayMoment): boolean {
    const words = TextNormalizer.normalizeText(category).split(/\s+/);
    return MOMENT_CATEGORIES[moment].some((keyword) => words.some((w) => w.startsWith(keyword)));
  }

  /** Points and reasons of one candidate (rules in recommendation-rules.ts). */
  public static scoreCandidate(c: RecommendationCandidate, moment: DayMoment): RecommendedBusiness {
    const reasons: RecommendationReason[] = [];
    let score = 0;
    if (RecommendationScoring.suitsMoment(c.business.category, moment)) {
      score += WEIGHTS.momentCategory;
      reasons.push('moment');
    }
    if (c.distanceKm !== null) {
      score += WEIGHTS.distance * Math.max(0, 1 - c.distanceKm / MAX_USEFUL_KM);
      if (c.distanceKm <= NEAR_KM) reasons.push('near');
    }
    if (c.rating !== null) {
      score += (WEIGHTS.rating * c.rating) / MAX_RATING;
      if (c.rating >= TOP_RATING) reasons.push('topRated');
    }
    if (c.hasPromotion) {
      score += WEIGHTS.promotion;
      reasons.push('promotion');
    }
    if (c.isFavorite) {
      score += WEIGHTS.favorite;
      reasons.push('favorite');
    }
    if (c.status === 'opening-soon') score += WEIGHTS.openingSoon;
    return { candidate: c, score: Math.round(score * SCORE_PRECISION) / SCORE_PRECISION, reasons };
  }
}


/** Recommender v1: deterministic rules, no external services. */
export class RulesRecommendationEngine implements RecommendationEngine {
  /** @inheritdoc */
  public recommend({ moment, candidates }: RecommendationRequest): Promise<Recommendation> {
    const businesses = candidates
      .filter((c) => RECOMMENDABLE_STATUSES.includes(c.status))
      .map((c) => RecommendationScoring.scoreCandidate(c, moment))
      .sort((a, b) => b.score - a.score || a.candidate.business.name.localeCompare(b.candidate.business.name))
      .slice(0, MAX_RECOMMENDATIONS);
    const combo = businesses.map((b) => ComboBuilder.buildCombo(b.candidate)).find((c) => c !== null) ?? null;
    return Promise.resolve({ businesses, combo });
  }
}

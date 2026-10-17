import { normalizeText } from '@shared/utils/normalize-text.util';
import { buildCombo } from './combo.util';
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

/** The moment a given hour (0–23) belongs to; nights wrap past midnight. */
export function momentForHour(hour: number): DayMoment {
  const started = DAY_MOMENTS.filter((moment) => MOMENT_START_HOUR[moment] <= hour);
  return started.at(-1) ?? 'night';
}

export function suitsMoment(category: string, moment: DayMoment): boolean {
  const words = normalizeText(category).split(/\s+/);
  return MOMENT_CATEGORIES[moment].some((keyword) => words.some((w) => w.startsWith(keyword)));
}

/** Points and reasons of one candidate (rules in recommendation-rules.ts). */
export function scoreCandidate(c: RecommendationCandidate, moment: DayMoment): RecommendedBusiness {
  const reasons: RecommendationReason[] = [];
  let score = 0;
  if (suitsMoment(c.business.category, moment)) {
    score += WEIGHTS.momentCategory;
    reasons.push('moment');
  }
  if (c.distanceKm !== null) {
    score += WEIGHTS.distance * Math.max(0, 1 - c.distanceKm / MAX_USEFUL_KM);
    if (c.distanceKm <= NEAR_KM) reasons.push('near');
  }
  if (c.rating !== null) {
    score += (WEIGHTS.rating * c.rating) / 5;
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
  return { candidate: c, score: Math.round(score * 10) / 10, reasons };
}

/** Recommender v1: deterministic rules, no external services. */
export class RulesRecommendationEngine implements RecommendationEngine {
  recommend({ moment, candidates }: RecommendationRequest): Promise<Recommendation> {
    const businesses = candidates
      .filter((c) => RECOMMENDABLE_STATUSES.includes(c.status))
      .map((c) => scoreCandidate(c, moment))
      .sort((a, b) => b.score - a.score || a.candidate.business.name.localeCompare(b.candidate.business.name))
      .slice(0, MAX_RECOMMENDATIONS);
    const combo = businesses.map((b) => buildCombo(b.candidate)).find((c) => c !== null) ?? null;
    return Promise.resolve({ businesses, combo });
  }
}

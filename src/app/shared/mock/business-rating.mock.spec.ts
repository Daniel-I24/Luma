import { describe, expect, it } from 'vitest';
import { MockBusinessRatingProvider } from './business-rating.mock';

describe('MockBusinessRatingProvider', () => {
  const provider = new MockBusinessRatingProvider();

  it('returns the same rating for the same business', () => {
    expect(provider.getRating('biz-1')).toEqual(provider.getRating('biz-1'));
  });

  it('keeps ratings between 3.5 and 5 with a positive review count', () => {
    for (const id of ['a', 'biz-1', '2f9c1d8e-0000-4000-8000-000000000000', 'zzz']) {
      const { rating, reviewCount } = provider.getRating(id);
      expect(rating).toBeGreaterThanOrEqual(3.5);
      expect(rating).toBeLessThanOrEqual(5);
      expect(reviewCount).toBeGreaterThan(0);
    }
  });
});

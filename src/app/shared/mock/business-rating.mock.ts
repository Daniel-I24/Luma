import { Injectable } from '@angular/core';
import { BusinessRatingProvider } from '@shared/business/data/business-rating.provider';
import type { BusinessRating } from '@shared/business/data/business-rating.provider';

/**
 * MOCK — ratings do not exist in the backend yet (see docs/mocks.md).
 * Derives a stable, plausible rating from the business id so every real
 * business always shows the same values between sessions.
 */
@Injectable()
export class MockBusinessRatingProvider extends BusinessRatingProvider {
  getRating(businessId: string): BusinessRating {
    const seed = hash(businessId);
    return {
      rating: 3.5 + (seed % 16) / 10,
      reviewCount: 12 + (seed % 289),
    };
  }
}

/** Small deterministic string hash (FNV-1a, 32-bit). */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

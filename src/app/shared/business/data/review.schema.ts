import * as z from 'zod/mini';
import { TextRules } from '@core/validation/text-rules';
import { ZodRules } from '@core/validation/zod-rules';

export const MAX_RATING = 5;

/** reviews_comment_rule: clean text of at most 500 characters. */
const MAX_COMMENT_LENGTH = 500;
export const REVIEW_COMMENT_RULE = TextRules.freeText(MAX_COMMENT_LENGTH);

/** Validates what a user writes in a review; the comment is cleaned and may be empty. */
export const reviewInputSchema = z.object({
  rating: z
    .int('reviews.validation.ratingRange')
    .check(
      z.minimum(1, 'reviews.validation.ratingRange'),
      z.maximum(MAX_RATING, 'reviews.validation.ratingRange'),
    ),
  comment: ZodRules.optionalText(REVIEW_COMMENT_RULE),
});

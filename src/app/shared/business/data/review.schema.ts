import * as z from 'zod/mini';

/** Limits mirror the CHECK constraints of public.reviews. */
const MAX_COMMENT_LENGTH = 500;

/** Validates what a user writes in a review; the comment is trimmed and may be empty. */
export const reviewInputSchema = z.object({
  rating: z
    .int('reviews.validation.ratingRange')
    .check(
      z.minimum(1, 'reviews.validation.ratingRange'),
      z.maximum(5, 'reviews.validation.ratingRange'),
    ),
  comment: z.nullable(
    z.pipe(
      z
        .string()
        .check(z.trim(), z.maxLength(MAX_COMMENT_LENGTH, 'reviews.validation.commentTooLong')),
      z.transform((comment) => (comment ? comment : null)),
    ),
  ),
});

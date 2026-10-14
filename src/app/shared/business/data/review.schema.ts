import { z } from 'zod';

/** Limits mirror the CHECK constraints of public.reviews. */
const MAX_COMMENT_LENGTH = 500;

/** Validates what a user writes in a review; the comment is trimmed and may be empty. */
export const reviewInputSchema = z.object({
  rating: z
    .number()
    .int('reviews.validation.ratingRange')
    .min(1, 'reviews.validation.ratingRange')
    .max(5, 'reviews.validation.ratingRange'),
  comment: z
    .string()
    .trim()
    .max(MAX_COMMENT_LENGTH, 'reviews.validation.commentTooLong')
    .nullable()
    .transform((comment) => (comment ? comment : null)),
});

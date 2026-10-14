import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { createFakeSupabase, failure, ok } from '../../../../testing/fake-supabase';
import type { FakeResponse } from '../../../../testing/fake-supabase';
import { REVIEW_COLUMNS, REVIEW_WITH_AUTHOR_COLUMNS, ReviewRepository } from './review.repository';

function setup(responses: Record<string, FakeResponse>) {
  const fake = createFakeSupabase(responses);
  TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: fake }] });
  return { repo: TestBed.inject(ReviewRepository), queries: fake.queries };
}

const review = { id: 'r1', business_id: 'b1', rating: 5, comment: 'Rico' };

describe('ReviewRepository', () => {
  it("reads the caller's own review through is_mine, not a user id", async () => {
    const row = { id: 'r1', business_id: 'b1', rating: 5, display_name: null, is_mine: true };
    const { repo, queries } = setup({ reviews_with_author: ok(row) });

    expect(await repo.getOwnReview('b1')).toEqual({ data: row, errorKey: null });
    expect(queries[0].calls.filter(([m]) => m === 'eq').map(([, a]) => a)).toEqual([
      ['business_id', 'b1'],
      ['is_mine', true],
    ]);
  });

  it('never selects * or user_id: only the columns clients may read', async () => {
    const { repo, queries } = setup({ reviews: ok(review), reviews_with_author: ok([]) });

    await repo.getReviews('b1');
    await repo.getOwnReview('b1');
    await repo.create('b1', { rating: 5, comment: null });
    await repo.update('r1', { rating: 4, comment: null });

    const selects = queries.map((q) => [q.table, q.call('select')?.[0]]);
    expect(selects).toEqual([
      ['reviews_with_author', REVIEW_WITH_AUTHOR_COLUMNS],
      ['reviews_with_author', REVIEW_WITH_AUTHOR_COLUMNS],
      ['reviews', REVIEW_COLUMNS],
      ['reviews', REVIEW_COLUMNS],
    ]);
    expect(REVIEW_COLUMNS.split(', ')).toEqual([
      'id',
      'business_id',
      'rating',
      'comment',
      'created_at',
      'updated_at',
    ]);
    expect(REVIEW_WITH_AUTHOR_COLUMNS).not.toMatch(/\*|user_id|email/);
  });

  it('returns null when the user has not reviewed the business', async () => {
    const { repo } = setup({ reviews_with_author: ok(null) });

    expect(await repo.getOwnReview('b1')).toEqual({ data: null, errorKey: null });
  });

  it('reads the latest reviews with author names from the safe view', async () => {
    const row = {
      id: 'r1',
      business_id: 'b1',
      rating: 5,
      comment: 'Rico',
      display_name: 'Ana M.',
      is_mine: false,
    };
    const { repo, queries } = setup({ reviews_with_author: ok([row]) });

    expect(await repo.getReviews('b1', 10)).toEqual({ data: [row], errorKey: null });
    expect(queries[0].table).toBe('reviews_with_author');
    expect(queries[0].call('order')).toEqual(['created_at', { ascending: false }]);
    expect(queries[0].call('limit')).toEqual([10]);
  });

  it('creates a review with a trimmed comment and no user id', async () => {
    const { repo, queries } = setup({ reviews: ok(review) });

    const result = await repo.create('b1', { rating: 5, comment: '  Rico  ' });

    expect(result).toEqual({ data: review, errorKey: null });
    expect(queries[0].call('insert')).toEqual([{ business_id: 'b1', rating: 5, comment: 'Rico' }]);
  });

  it('stores an empty comment as null', async () => {
    const { repo, queries } = setup({ reviews: ok(review) });

    await repo.create('b1', { rating: 4, comment: '   ' });

    expect(queries[0].call('insert')).toEqual([{ business_id: 'b1', rating: 4, comment: null }]);
  });

  it('rejects invalid input before calling the database', async () => {
    const { repo, queries } = setup({});

    expect((await repo.create('b1', { rating: 6, comment: null })).errorKey).toBe(
      'reviews.validation.ratingRange',
    );
    expect((await repo.create('b1', { rating: 4.5, comment: null })).errorKey).toBe(
      'reviews.validation.ratingRange',
    );
    expect((await repo.update('r1', { rating: 3, comment: 'a'.repeat(501) })).errorKey).toBe(
      'reviews.validation.commentTooLong',
    );
    expect(queries).toHaveLength(0);
  });

  it('updates only rating and comment of one review', async () => {
    const { repo, queries } = setup({ reviews: ok({ ...review, rating: 3 }) });

    expect((await repo.update('r1', { rating: 3, comment: null })).data?.rating).toBe(3);
    expect(queries[0].call('update')).toEqual([{ rating: 3, comment: null }]);
    expect(queries[0].call('eq')).toEqual(['id', 'r1']);
  });

  it('deletes a review', async () => {
    const { repo, queries } = setup({ reviews: ok(null) });

    expect(await repo.remove('r1')).toEqual({ data: true, errorKey: null });
    expect(queries[0].call('eq')).toEqual(['id', 'r1']);
  });

  it('maps Supabase errors, including RLS rejections, to i18n keys', async () => {
    const { repo } = setup({
      reviews_with_author: failure(),
      reviews: failure('violates row-level security'),
    });

    expect((await repo.getReviews('b1')).errorKey).toBe('businesses.errors.reviewsFailed');
    expect((await repo.create('b1', { rating: 5, comment: null })).errorKey).toBe(
      'businesses.errors.reviewSaveFailed',
    );
    expect((await repo.remove('r1')).errorKey).toBe('businesses.errors.reviewDeleteFailed');
  });
});

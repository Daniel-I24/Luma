import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from '@design-system/toast/toast.service';
import { ReviewRepository } from '@shared/business/data/review.repository';
import { ReviewsStore } from './reviews.store';

const own = { id: 'r1', business_id: 'b1', rating: 4, comment: null, is_mine: true };

describe('ReviewsStore', () => {
  const repo = {
    getReviews: vi.fn(),
    getOwnReview: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const toasts = { show: vi.fn() };
  let store: ReviewsStore;

  beforeEach(() => {
    vi.clearAllMocks();
    repo.getReviews.mockResolvedValue({ data: [], errorKey: null });
    repo.getOwnReview.mockResolvedValue({ data: null, errorKey: null });
    repo.create.mockResolvedValue({ data: own, errorKey: null });
    repo.update.mockResolvedValue({ data: own, errorKey: null });
    repo.remove.mockResolvedValue({ data: true, errorKey: null });
    TestBed.configureTestingModule({
      providers: [
        ReviewsStore,
        { provide: ReviewRepository, useValue: repo },
        { provide: ToastService, useValue: toasts },
      ],
    });
    store = TestBed.inject(ReviewsStore);
  });

  it('creates a review when the user has none, then reloads', async () => {
    await store.load('b1');

    expect(await store.save('b1', { rating: 5, comment: 'Top' })).toBe(true);
    expect(repo.create).toHaveBeenCalledWith('b1', { rating: 5, comment: 'Top' });
    expect(repo.getReviews).toHaveBeenCalledTimes(2);
    expect(toasts.show).toHaveBeenCalledWith({ messageKey: 'reviews.saved', tone: 'success' });
  });

  it('updates the existing review instead of creating a second one', async () => {
    repo.getOwnReview.mockResolvedValue({ data: own, errorKey: null });
    await store.load('b1');

    await store.save('b1', { rating: 2, comment: null });

    expect(repo.update).toHaveBeenCalledWith('r1', { rating: 2, comment: null });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('deletes the own review', async () => {
    repo.getOwnReview.mockResolvedValue({ data: own, errorKey: null });
    await store.load('b1');

    expect(await store.remove('b1')).toBe(true);
    expect(repo.remove).toHaveBeenCalledWith('r1');
  });

  it('keeps the form error and does not toast when saving fails', async () => {
    repo.create.mockResolvedValue({ data: null, errorKey: 'businesses.errors.reviewSaveFailed' });
    await store.load('b1');

    expect(await store.save('b1', { rating: 5, comment: null })).toBe(false);
    expect(store.formErrorKey()).toBe('businesses.errors.reviewSaveFailed');
    expect(store.saving()).toBe(false);
    expect(toasts.show).not.toHaveBeenCalled();
  });
});

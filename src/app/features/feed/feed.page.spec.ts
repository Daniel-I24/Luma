import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoritesStore } from '@shared/favorites/favorites.store';
import { FeedPage } from './feed.page';
import type { FeedCard } from './models/feed-card.model';
import { FeedStore, type FeedState } from './state/feed.store';

const card = (n: number): FeedCard =>
  ({
    id: `dish:m${n}`,
    kind: 'dish',
    title: `Plato ${n}`,
    description: null,
    imageUrl: null,
    priceCop: 1000 * n,
    listPriceCop: null,
    discountPercent: null,
    validUntil: null,
    business: { id: `b${n}`, name: `Negocio ${n}` },
    status: 'open',
    distanceKm: null,
    icon: 'utensils',
    menuItem: null,
  }) as unknown as FeedCard;

describe('FeedPage', () => {
  const state = signal<FeedState>('ready');
  const cards = signal<FeedCard[]>([card(1), card(2), card(3)]);
  const store = {
    state,
    cards,
    loadingMore: signal(false),
    moreFailed: signal(false),
    hasMore: signal(false),
    empty: computed(() => state() === 'ready' && cards().length === 0),
    load: vi.fn(),
    loadMore: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    state.set('ready');
    cards.set([card(1), card(2), card(3)]);
    HTMLElement.prototype.scrollTo = vi.fn();
    TestBed.configureTestingModule({
      imports: [
        FeedPage,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: FavoritesStore, useValue: { ids: signal(new Set()), toggle: vi.fn() } },
      ],
    }).overrideComponent(FeedPage, {
      set: { providers: [{ provide: FeedStore, useValue: store }] },
    });
  });

  function render() {
    const fixture = TestBed.createComponent(FeedPage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('loads on start and renders each post as an article of the feed', () => {
    const { el } = render();

    expect(store.load).toHaveBeenCalledOnce();
    const articles = el.querySelectorAll('[role="feed"] article');
    expect(articles).toHaveLength(3);
    expect(articles[1].getAttribute('aria-posinset')).toBe('2');
    expect(articles[1].getAttribute('aria-setsize')).toBe('3');
    expect(articles[1].textContent).toContain('Plato 2');
  });

  it('moves to the next and previous post with the arrow keys', () => {
    const { fixture, el } = render();
    const feed = el.querySelector<HTMLElement>('[role="feed"]')!;
    const articles = el.querySelectorAll<HTMLElement>('article');

    feed.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(articles[1]);

    feed.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(document.activeElement).toBe(articles[0]);
  });

  it('opens the business profile from a post', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { el } = render();

    el.querySelector<HTMLButtonElement>('article app-luma-button button')!.click();

    expect(navigate).toHaveBeenCalledWith(['/businesses', 'b1']);
  });

  it('shows designed error (with retry) and empty states', () => {
    state.set('error');
    const { fixture, el } = render();
    el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    expect(store.load).toHaveBeenCalledTimes(2);

    state.set('ready');
    cards.set([]);
    fixture.detectChanges();
    expect(el.querySelector('[role="feed"]')).toBeNull();
    expect(el.querySelector('app-luma-empty-state')).not.toBeNull();
  });
});

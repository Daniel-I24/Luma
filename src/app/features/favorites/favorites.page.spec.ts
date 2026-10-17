import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { FavoritesStore } from '@shared/favorites/favorites.store';
import { FavoritesPage } from './favorites.page';
import { useFixedClock } from '../../../testing/fixed-clock';

const flush = () => new Promise((resolve) => setTimeout(resolve));
const business = (id: string, name: string) => ({
  id,
  name,
  category: 'Cafetería',
  logo_url: null,
});

describe('FavoritesPage', () => {
  useFixedClock();

  const ids = signal<ReadonlySet<string>>(new Set(['b2', 'b1']));
  const ready = signal(true);
  const favorites = { ids, ready, failed: signal(false), reload: vi.fn(), toggle: vi.fn() };
  const repo = { getByIds: vi.fn(), getHoursFor: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    ids.set(new Set(['b2', 'b1']));
    ready.set(true);
    repo.getByIds.mockResolvedValue({
      data: [business('b1', 'Fritanga'), business('b2', 'Café')],
      errorKey: null,
    });
    repo.getHoursFor.mockResolvedValue({ data: [], errorKey: null });
    TestBed.configureTestingModule({
      imports: [
        FavoritesPage,
        TranslocoTestingModule.forRoot({
          langs: { es: { favoritesPage: { empty: { title: 'Aún no tienes favoritos' } } } },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: FavoritesStore, useValue: favorites },
        { provide: BusinessRepository, useValue: repo },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(FavoritesPage);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('loads the businesses with one query and lists them in favourites order', async () => {
    const { el } = await render();

    expect(repo.getByIds).toHaveBeenCalledOnce();
    expect(repo.getByIds).toHaveBeenCalledWith(['b2', 'b1']);
    const cards = Array.from(el.querySelectorAll('app-luma-business-card'));
    expect(cards.map((c) => c.textContent?.includes('Café'))).toEqual([true, false]);
    expect(cards[1].textContent).toContain('Fritanga');
  });

  it('removes a card as soon as its heart is cleared', async () => {
    const { fixture, el } = await render();

    ids.set(new Set(['b1']));
    fixture.detectChanges();

    expect(el.querySelectorAll('app-luma-business-card')).toHaveLength(1);
  });

  it('waits for the favourite ids before loading, then shows the empty state', async () => {
    ready.set(false);
    ids.set(new Set());
    const { fixture, el } = await render();
    expect(repo.getByIds).not.toHaveBeenCalled();
    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();

    ready.set(true);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(el.textContent).toContain('Aún no tienes favoritos');
  });

  it('retries the favourite ids themselves when they failed', async () => {
    favorites.failed.set(true);
    const { el } = await render();

    el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();

    expect(favorites.reload).toHaveBeenCalled();
    favorites.failed.set(false);
  });
});

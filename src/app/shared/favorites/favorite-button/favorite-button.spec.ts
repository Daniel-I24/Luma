import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoritesStore } from '../favorites.store';
import { FavoriteButton } from './favorite-button';

describe('FavoriteButton', () => {
  const ids = signal<ReadonlySet<string>>(new Set(['b1']));
  const store = { ids, toggle: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    ids.set(new Set(['b1']));
    TestBed.configureTestingModule({
      imports: [
        FavoriteButton,
        TranslocoTestingModule.forRoot({
          langs: {
            es: { favorites: { add: 'Guardar en favoritos', remove: 'Quitar de favoritos' } },
          },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [{ provide: FavoritesStore, useValue: store }],
    });
  });

  function render(businessId: string) {
    const fixture = TestBed.createComponent(FavoriteButton);
    fixture.componentRef.setInput('businessId', businessId);
    fixture.detectChanges();
    return { fixture, button: (fixture.nativeElement as HTMLElement).querySelector('button')! };
  }

  it('shows a pressed, labelled heart for favourites', () => {
    const { button } = render('b1');

    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Quitar de favoritos');
  });

  it('offers to save businesses that are not favourites', () => {
    const { button } = render('b2');

    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Guardar en favoritos');
  });

  it('toggles through the store and follows its state', () => {
    const { fixture, button } = render('b2');

    button.click();
    ids.set(new Set(['b1', 'b2']));
    fixture.detectChanges();

    expect(store.toggle).toHaveBeenCalledWith('b2');
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});

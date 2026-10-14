import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import { LumaRatingStars } from './luma-rating-stars';

const ES = {
  rating: {
    label: 'Calificación {{rating}} de 5',
    labelWithReviews: 'Calificación {{rating}} de 5, {{count}} reseñas',
    reviews: '({{count}} reseñas)',
  },
};

describe('LumaRatingStars', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        LumaRatingStars,
        TranslocoTestingModule.forRoot({
          langs: { es: ES },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
    });
  });

  function render(rating: number, reviewCount: number | null = null): HTMLElement {
    const fixture = TestBed.createComponent(LumaRatingStars);
    fixture.componentRef.setInput('rating', rating);
    fixture.componentRef.setInput('reviewCount', reviewCount);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the score with one decimal in the active language', () => {
    const el = render(4.8);

    expect(el.querySelector('[aria-hidden="true"]')?.textContent).toContain('4,8');
  });

  it('shows the review count when known', () => {
    const el = render(4, 120);

    expect(el.textContent).toContain('(120 reseñas)');
    expect(el.querySelector('.sr-only')?.textContent?.trim()).toBe(
      'Calificación 4,0 de 5, 120 reseñas',
    );
  });

  it('gives screen readers a single sentence without reviews', () => {
    const el = render(3.5);

    expect(el.querySelector('.sr-only')?.textContent?.trim()).toBe('Calificación 3,5 de 5');
  });
});
